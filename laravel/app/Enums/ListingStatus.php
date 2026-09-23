<?php

declare(strict_types=1);

namespace App\Enums;

/** Lifecycle. Only `Published` is publicly readable. */
enum ListingStatus: string
{
    case Draft = 'draft';
    case Pending = 'pending';
    // Submitted while the site is held behind the pre-launch countdown. Hidden
    // from the public by the same rule as every other unpublished status, so
    // holding content costs nothing extra.
    case PendingLaunch = 'pendingLaunch';
    case Published = 'published';
    case Rejected = 'rejected';
    case Expired = 'expired';
    case Sold = 'sold';
    case Rented = 'rented';
    case Archived = 'archived';

    public function label(): string
    {
        return __('listing.statuses.'.$this->value);
    }

    /** The one status the public may see. */
    public function isPublic(): bool
    {
        return $this === self::Published;
    }

    /** Still counts against the owner's quota: pending and published both do. */
    public function countsAgainstQuota(): bool
    {
        return in_array($this, [self::Pending, self::PendingLaunch, self::Published], true);
    }
}
