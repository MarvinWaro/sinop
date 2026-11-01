<?php

use App\Events\ConversationTyping;
use App\Events\MessagesUpdated;
use App\Models\ActivityLog;
use App\Models\Conversation;
use App\Models\Location;
use App\Models\MessageAttachment;
use App\Models\Property;
use App\Models\RisSlip;
use App\Models\User;
use App\Services\Messenger;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;

beforeEach(function () {
    Storage::fake('public');

    $this->staff = User::factory()->create(['name' => 'Alea Deloso']);
    $this->colleague = User::factory()->create();
    $this->cao = User::factory()->cao()->create(['name' => 'Maria Samonte']);
    $division = DB::table('departments')->insertGetId(['name' => 'Admin Division', 'created_at' => now(), 'updated_at' => now()]);
    $this->ris = RisSlip::create(['ris_no' => '2026-10-002', 'ris_date' => now(), 'entity_name' => 'CHED', 'division' => $division, 'requested_by' => $this->staff->id, 'status' => 'draft']);
});

/** Starts a conversation over HTTP as `$user`; returns its id. */
function startConversation(User $user, array $data): int
{
    return test()->actingAs($user)
        ->postJson(route('messages.start'), $data + ['body' => 'Hello'])
        ->assertCreated()
        ->json('conversation.id');
}

test('the page opens for signed-in people, and the office side is told it answers for the office', function () {
    $this->get(route('messages.index'))->assertRedirect(route('login'));

    $this->actingAs($this->staff)->get(route('messages.index'))
        ->assertInertia(fn (Assert $page) => $page->component('messages/index')->where('isOffice', false)->where('people', []));

    $this->actingAs($this->cao)->get(route('messages.index'))
        ->assertInertia(fn (Assert $page) => $page->where('isOffice', true)->has('people', 2));
});

test('a requester asks about their own request, and the office sees it waiting', function () {
    $id = startConversation($this->staff, ['kind' => 'request', 'ris_id' => $this->ris->ris_id, 'body' => 'When can I pick it up?']);

    $conversation = Conversation::findOrFail($id);
    expect($conversation->requester_id)->toBe($this->staff->id)
        ->and($conversation->subject)->toBe('2026-10-002')
        ->and($conversation->status)->toBe('waiting');

    $this->actingAs($this->cao)->getJson(route('messages.conversations', ['tab' => 'waiting']))
        ->assertOk()
        ->assertJsonPath('data.0.id', $id)
        ->assertJsonPath('data.0.unread', 1)
        ->assertJsonPath('data.0.last.body', 'When can I pick it up?')
        ->assertJsonPath('counts.waiting', 1);

    // Asking again adds to the same conversation.
    expect(startConversation($this->staff, ['kind' => 'request', 'ris_id' => $this->ris->ris_id]))->toBe($id)
        ->and(Conversation::count())->toBe(1);
});

test('requesters can\'t write about someone else\'s request or pick who they write to', function () {
    $this->actingAs($this->colleague)
        ->postJson(route('messages.start'), ['kind' => 'request', 'ris_id' => $this->ris->ris_id, 'body' => 'Hi'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('ris_id');

    $this->actingAs($this->colleague)
        ->postJson(route('messages.start'), ['kind' => 'general', 'subject' => 'Hi', 'requester_id' => $this->staff->id, 'body' => 'Hi'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors('requester_id');
});

test('the office can start a conversation with a person, about a request or anything', function () {
    $about = startConversation($this->cao, ['kind' => 'request', 'ris_id' => $this->ris->ris_id]);
    $general = startConversation($this->cao, ['kind' => 'general', 'subject' => 'Year-end inventory', 'requester_id' => $this->staff->id]);

    expect(Conversation::find($about)->requester_id)->toBe($this->staff->id)
        ->and(Conversation::find($general)->status)->toBe('open');

    $this->actingAs($this->cao)
        ->postJson(route('messages.start'), ['kind' => 'general', 'subject' => 'Hi', 'body' => 'Hi'])
        ->assertJsonValidationErrors('requester_id');
});

test('a concern can be about one of the requester\'s properties', function () {
    $location = Location::create(['location_name' => 'Records room'])->id;
    $property = Property::create(['property_number' => 'PPE-1', 'item_name' => 'Printer', 'user_id' => $this->staff->id, 'location_id' => $location, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1]);
    $other = Property::create(['property_number' => 'PPE-2', 'item_name' => 'Laptop', 'user_id' => $this->colleague->id, 'location_id' => $location, 'condition' => 'Serviceable', 'quantity_per_physical_count' => 1]);

    $id = startConversation($this->staff, ['kind' => 'concern', 'property_id' => $property->id]);
    expect(Conversation::find($id)->subject)->toBe('Printer (PPE-1)');

    $this->actingAs($this->staff)
        ->postJson(route('messages.start'), ['kind' => 'concern', 'property_id' => $other->id, 'body' => 'Hi'])
        ->assertJsonValidationErrors('property_id');

    $this->actingAs($this->staff)->getJson(route('messages.options'))
        ->assertJsonPath('properties.0.number', 'PPE-1')
        ->assertJsonCount(1, 'properties')
        ->assertJsonPath('requests.0.no', '2026-10-002');
});

test('people see only their own conversations; the office sees all', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Printer ink']);

    $this->actingAs($this->colleague)->getJson(route('messages.conversations'))->assertJsonCount(0, 'data');
    $this->actingAs($this->colleague)->getJson(route('messages.show', $id))->assertForbidden();
    $this->actingAs($this->colleague)->postJson(route('messages.send', $id), ['body' => 'Hi'])->assertForbidden();

    $this->actingAs($this->staff)->getJson(route('messages.conversations'))->assertJsonCount(1, 'data');
    $this->actingAs($this->cao)->getJson(route('messages.show', $id))->assertOk()->assertJsonPath('messages.0.body', 'Hello');
});

test('replies change the status and the unread counts on each side', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Printer ink']);
    $messenger = app(Messenger::class);

    expect($messenger->unreadCountFor($this->cao))->toBe(1)
        ->and($messenger->unreadCountFor($this->staff))->toBe(0);

    $this->actingAs($this->cao)->postJson(route('messages.send', $id), ['body' => 'We have some.'])->assertCreated()
        ->assertJsonPath('message.side', 'office')
        ->assertJsonPath('message.mine', true);

    expect(Conversation::find($id)->status)->toBe('open')
        ->and($messenger->unreadCountFor($this->cao))->toBe(0)
        ->and($messenger->unreadCountFor($this->staff))->toBe(1);

    $this->actingAs($this->staff)->get(route('messages.index'))
        ->assertInertia(fn (Assert $page) => $page->where('messagesUnread', 1));

    $this->actingAs($this->staff)->postJson(route('messages.read', $id))->assertJsonPath('unread', 0);
});

test('resolving leaves a line in the thread, and reopening waits on whoever spoke last', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Printer ink']);

    $this->actingAs($this->cao)->patchJson(route('messages.status', $id), ['resolved' => true])
        ->assertJsonPath('conversation.status', 'resolved');
    $this->actingAs($this->cao)->getJson(route('messages.show', $id))
        ->assertJsonPath('messages.1.side', 'system')
        ->assertJsonPath('messages.1.body', 'resolved')
        ->assertJsonPath('messages.1.author.name', 'Maria Samonte');

    $this->actingAs($this->staff)->patchJson(route('messages.status', $id), ['resolved' => false])
        ->assertJsonPath('conversation.status', 'waiting');

    // Status lines don't count as unread.
    expect(app(Messenger::class)->unreadCountFor($this->cao))->toBe(0);
});

test('files are kept for the people in the conversation only', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Broken chair']);

    $this->actingAs($this->staff)->post(route('messages.send', $id), [
        'files' => [UploadedFile::fake()->image('chair.jpg'), UploadedFile::fake()->create('list.pdf', 200, 'application/pdf')],
    ], ['Accept' => 'application/json'])
        ->assertCreated()
        ->assertJsonPath('message.body', null)
        ->assertJsonCount(2, 'message.attachments');

    $photo = MessageAttachment::where('name', 'chair.jpg')->sole();
    Storage::disk('public')->assertExists($photo->path);
    expect($photo->path)->toStartWith('message-attachments/');

    $this->actingAs($this->staff)->get(route('messages.attachment', $photo))->assertOk();
    $this->actingAs($this->cao)->get(route('messages.attachment', $photo))->assertOk();
    $this->actingAs($this->colleague)->getJson(route('messages.attachment', $photo))->assertForbidden();
    // Not served through the general uploads route.
    $this->actingAs($this->staff)->get('/files/'.$photo->path)->assertNotFound();
});

test('only photos, PDFs and spreadsheets up to 10 MB can be attached', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Files']);

    $this->actingAs($this->staff)->post(route('messages.send', $id), [
        'files' => [UploadedFile::fake()->create('run.exe', 10, 'application/x-msdownload')],
    ], ['Accept' => 'application/json'])->assertJsonValidationErrors('files.0');

    $this->actingAs($this->staff)->post(route('messages.send', $id), [
        'files' => [UploadedFile::fake()->create('big.pdf', 11 * 1024, 'application/pdf')],
    ], ['Accept' => 'application/json'])->assertJsonValidationErrors('files.0');

    $this->actingAs($this->staff)->postJson(route('messages.send', $id), ['body' => '  '])
        ->assertJsonValidationErrors('body');
});

test('the others hear about new messages live; typing is sent at most every few seconds', function () {
    $id = startConversation($this->staff, ['kind' => 'general', 'subject' => 'Printer ink']);
    Event::fake([MessagesUpdated::class, ConversationTyping::class]);

    $this->actingAs($this->staff)->postJson(route('messages.send', $id), ['body' => 'Any update?'])->assertCreated();
    app()->terminate();

    Event::assertDispatched(MessagesUpdated::class, fn (MessagesUpdated $event) => $event->conversationId === $id
        && in_array($this->cao->id, $event->userIds, true)
        && ! in_array($this->staff->id, $event->userIds, true)
        && ! in_array($this->colleague->id, $event->userIds, true));

    $this->actingAs($this->cao)->postJson(route('messages.typing', $id))->assertOk();
    $this->actingAs($this->cao)->postJson(route('messages.typing', $id))->assertOk();

    Event::assertDispatchedTimes(ConversationTyping::class, 1);
    Event::assertDispatched(ConversationTyping::class, fn (ConversationTyping $event) => $event->name === 'Maria'
        && in_array($this->staff->id, $event->userIds, true)
        && ! in_array($this->cao->id, $event->userIds, true));
});

test('a request\'s thread shows its history and what was asked for', function () {
    $id = startConversation($this->staff, ['kind' => 'request', 'ris_id' => $this->ris->ris_id]);
    ActivityLog::create(['actor_name' => 'Maria Samonte', 'module' => 'ris', 'action' => 'approved', 'subject_type' => 'ris', 'subject_id' => (string) $this->ris->ris_id]);
    ActivityLog::create(['actor_name' => 'Maria Samonte', 'module' => 'ris', 'action' => 'exported', 'subject_type' => 'ris', 'subject_id' => (string) $this->ris->ris_id]);

    $this->actingAs($this->staff)->getJson(route('messages.show', $id))
        ->assertJsonCount(1, 'events')
        ->assertJsonPath('events.0.body', 'Approved by Maria Samonte')
        ->assertJsonPath('context.ris.no', '2026-10-002')
        ->assertJsonPath('conversation.ris.key', $this->ris->route_key);
});

test('a link from an RIS opens its conversation, or offers to start one', function () {
    $this->actingAs($this->staff)->get(route('messages.index', ['ris' => $this->ris->route_key]))
        ->assertInertia(fn (Assert $page) => $page->where('opening.ris.no', '2026-10-002'));

    $id = startConversation($this->staff, ['kind' => 'request', 'ris_id' => $this->ris->ris_id]);

    $this->actingAs($this->cao)->get(route('messages.index', ['ris' => $this->ris->route_key]))
        ->assertInertia(fn (Assert $page) => $page->where('opening.conversation', $id));

    // Someone else's RIS opens nothing.
    $this->actingAs($this->colleague)->get(route('messages.index', ['ris' => $this->ris->route_key]))
        ->assertInertia(fn (Assert $page) => $page->where('opening', null));
});
