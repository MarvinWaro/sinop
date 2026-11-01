<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A file sent with a message, kept in message-attachments/ on the uploads
 * disk. Served only to the people in the conversation
 * (MessageController::attachment), never through /files.
 *
 * @property int $id
 * @property int $message_id
 * @property string $path
 * @property string $name
 * @property string $mime
 * @property int $size
 */
class MessageAttachment extends Model
{
    protected $guarded = ['id'];

    /** @return BelongsTo<Message, $this> */
    public function message(): BelongsTo
    {
        return $this->belongsTo(Message::class);
    }

    public function url(): string
    {
        return route('messages.attachment', $this, false);
    }
}
