<?php

namespace App\Enums;

/** Where in SINOP an activity log entry happened. Codes are stored as they are. */
enum ActivityModule: string
{
    case Authentication = 'authentication';
    case Account = 'account';
    case Users = 'users';
    case Roles = 'roles';
    case Divisions = 'divisions';
    case Designations = 'designations';
    case Categories = 'categories';
    case Suppliers = 'suppliers';
    case Locations = 'locations';
    case Supplies = 'supplies';
    case Stocks = 'stocks';
    case Transactions = 'transactions';
    case Ris = 'ris';
    case Reports = 'reports';
    case Properties = 'properties';
    case Settings = 'settings';
    case System = 'system';

    public function label(): string
    {
        return match ($this) {
            self::Authentication => 'Authentication',
            self::Account => 'My account',
            self::Users => 'Users',
            self::Roles => 'Roles & permissions',
            self::Divisions => 'Divisions',
            self::Designations => 'Designations',
            self::Categories => 'Categories',
            self::Suppliers => 'Suppliers',
            self::Locations => 'Property locations',
            self::Supplies => 'Supplies',
            self::Stocks => 'Stocks (IAR)',
            self::Transactions => 'Transactions',
            self::Ris => 'Requisitions (RIS)',
            self::Reports => 'Reports',
            self::Properties => 'Properties',
            self::Settings => 'Settings',
            self::System => 'System',
        };
    }
}
