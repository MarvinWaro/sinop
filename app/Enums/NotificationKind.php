<?php

namespace App\Enums;

/**
 * What a notification is about. The codes are stored in
 * `notifications.kind`: never rename or reuse one.
 */
enum NotificationKind: string
{
    case RisSubmitted = 'ris_submitted';
    case RisApproved = 'ris_approved';
    case RisReadyToIssue = 'ris_ready_to_issue';
    case RisDeclined = 'ris_declined';
    case RisIssued = 'ris_issued';
    case RisReceived = 'ris_received';
    case StockLow = 'stock_low';
    case StockOut = 'stock_out';
    case IarRecorded = 'iar_recorded';
    case AccountRequested = 'account_requested';
    case AccountActivated = 'account_activated';
    case PropertyAssigned = 'property_assigned';

    /** The Type filter's name for it. */
    public function label(): string
    {
        return match ($this) {
            self::RisSubmitted => 'New requisition',
            self::RisApproved => 'Requisition approved',
            self::RisReadyToIssue => 'Ready to issue',
            self::RisDeclined => 'Requisition declined',
            self::RisIssued => 'Supplies issued',
            self::RisReceived => 'Supplies received',
            self::StockLow => 'Low stock',
            self::StockOut => 'Out of stock',
            self::IarRecorded => 'IAR recorded',
            self::AccountRequested => 'Account request',
            self::AccountActivated => 'Account activated',
            self::PropertyAssigned => 'Property assigned',
        };
    }

    /** Where it belongs, for the Module filter. */
    public function module(): ActivityModule
    {
        return match ($this) {
            self::RisSubmitted, self::RisApproved, self::RisReadyToIssue,
            self::RisDeclined, self::RisIssued, self::RisReceived => ActivityModule::Ris,
            self::StockLow, self::StockOut, self::IarRecorded => ActivityModule::Stocks,
            self::AccountRequested, self::AccountActivated => ActivityModule::Users,
            self::PropertyAssigned => ActivityModule::Properties,
        };
    }

    /** positive | info | warning | danger: the colour of its icon. */
    public function tone(): string
    {
        return match ($this) {
            self::RisApproved, self::RisIssued, self::RisReceived, self::AccountActivated => 'positive',
            self::StockLow => 'warning',
            self::RisDeclined, self::StockOut => 'danger',
            default => 'info',
        };
    }

    /**
     * The sentence after the actor's name; `:subject` is the record's name
     * (shown bold), e.g. "approved your :subject".
     */
    public function sentence(): string
    {
        return match ($this) {
            self::RisSubmitted => 'submitted :subject for approval',
            self::RisApproved => 'approved your :subject',
            self::RisReadyToIssue => 'approved :subject; it is ready to issue',
            self::RisDeclined => 'declined your :subject',
            self::RisIssued => 'issued the supplies for :subject',
            self::RisReceived => 'confirmed receipt of :subject',
            self::StockLow => ':subject is running low',
            self::StockOut => ':subject is out of stock',
            self::IarRecorded => 'recorded :subject',
            self::AccountRequested => ':subject registered and is waiting for activation',
            self::AccountActivated => 'activated your account',
            self::PropertyAssigned => 'assigned :subject to you',
        };
    }

    /** False for system notices, whose sentence starts with the record. */
    public function showsActor(): bool
    {
        return ! in_array($this, [self::StockLow, self::StockOut, self::AccountRequested], true);
    }
}
