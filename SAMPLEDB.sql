-- Game Web Store Database Schema
-- Educational demonstration - Store layer only
-- Game integration tables/fields have been noted with comments

USE [master]
GO

CREATE DATABASE [Store]
GO

USE [Store]
GO

-- Create schemas
CREATE SCHEMA [forum]
GO
CREATE SCHEMA [store]
GO

-- ============================================
-- STORE TABLES
-- ============================================

-- Users table
CREATE TABLE [store].[users](
    [id] [uniqueidentifier] NOT NULL DEFAULT NEWID(),
    [email] [nvarchar](255) NOT NULL,
    [username] [nvarchar](50) NOT NULL,
    [password_hash] [nvarchar](max) NOT NULL,
    [game_user_no] [int] NULL, -- ⚠️ Link to game database user ID
    [created_at] [datetime2](0) NOT NULL DEFAULT SYSUTCDATETIME(),
    [profile_image] [nvarchar](50) NULL,
    [account_balance] [int] NULL DEFAULT 0,
    CONSTRAINT [PK_users] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_users_email] UNIQUE ([email]),
    CONSTRAINT [UQ_users_username] UNIQUE ([username]),
    CONSTRAINT [CK_users_balance] CHECK ([account_balance] >= 0)
)
GO

-- Sessions table
CREATE TABLE [store].[sessions](
    [id] [uniqueidentifier] NOT NULL DEFAULT NEWID(),
    [user_id] [uniqueidentifier] NOT NULL,
    [created_at] [datetime2](0) NOT NULL DEFAULT SYSUTCDATETIME(),
    [expires_at] [datetime2](0) NOT NULL,
    [user_agent] [nvarchar](255) NULL,
    [ip] [nvarchar](45) NULL,
    CONSTRAINT [PK_sessions] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_sessions_users] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]) ON DELETE CASCADE
)
GO

CREATE NONCLUSTERED INDEX [IX_sessions_user_expires] ON [store].[sessions]([user_id] ASC, [expires_at] ASC)
GO

-- Roles table
CREATE TABLE [store].[roles](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [name] [nvarchar](50) NOT NULL,
    [color] [varchar](200) NULL,
    [created_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_roles] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_roles_name] UNIQUE ([name])
)
GO

-- User roles junction table
CREATE TABLE [store].[user_roles](
    [user_id] [uniqueidentifier] NOT NULL,
    [role_id] [int] NOT NULL,
    [granted_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_user_roles] PRIMARY KEY CLUSTERED ([user_id] ASC, [role_id] ASC),
    CONSTRAINT [FK_user_roles_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_user_roles_role] FOREIGN KEY([role_id]) REFERENCES [store].[roles]([id])
)
GO

-- Items table
CREATE TABLE [store].[items](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [name] [nvarchar](100) NOT NULL,
    [description] [nvarchar](500) NULL,
    [goods_no] [int] NOT NULL, -- ⚠️ Item ID in game database
    [price] [int] NOT NULL,
    [item_type] [nvarchar](50) NULL,
    [is_active] [bit] NULL DEFAULT 1,
    [created_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_items] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [CK_ItemType] CHECK ([item_type] IN ('buffs', 'consumables', 'mounts', 'costumes', 'crates', 'bundles', 'misc'))
)
GO

CREATE NONCLUSTERED INDEX [IX_items_active_type] ON [store].[items]([is_active] ASC, [item_type] ASC)
GO

-- Purchases table
CREATE TABLE [store].[purchases](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [user_id] [uniqueidentifier] NOT NULL,
    [item_id] [int] NOT NULL,
    [quantity] [int] NOT NULL,
    [unit_price] [int] NOT NULL,
    [total_price] [int] NOT NULL,
    [game_user_no] [int] NOT NULL, -- ⚠️ Game database user ID for item delivery
    [order_status] [nvarchar](20) NULL DEFAULT 'pending',
    [created_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    [completed_at] [datetime2](7) NULL,
    CONSTRAINT [PK_purchases] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_purchases_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_purchases_item] FOREIGN KEY([item_id]) REFERENCES [store].[items]([id]),
    CONSTRAINT [CK_purchases_quantity] CHECK ([quantity] > 0),
    CONSTRAINT [CK_purchases_price] CHECK ([unit_price] >= 0 AND [total_price] >= 0),
    CONSTRAINT [CK_purchases_status] CHECK ([order_status] IN ('pending', 'completed', 'failed'))
)
GO

CREATE NONCLUSTERED INDEX [IX_purchases_user_status] ON [store].[purchases]([user_id] ASC, [order_status] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_purchases_created] ON [store].[purchases]([created_at] DESC)
GO

-- Crate contents table (for mystery boxes)
CREATE TABLE [store].[crate_contents](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [crate_item_id] [int] NOT NULL,
    [item_goods_no] [int] NOT NULL, -- ⚠️ Game item ID
    [item_name] [nvarchar](100) NOT NULL,
    [item_description] [nvarchar](500) NULL,
    [rarity] [nvarchar](20) NOT NULL,
    [drop_weight] [int] NOT NULL,
    [is_active] [bit] NULL DEFAULT 1,
    [created_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_crate_contents] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_crate_contents_item] FOREIGN KEY([crate_item_id]) REFERENCES [store].[items]([id]),
    CONSTRAINT [CK_crate_contents_rarity] CHECK ([rarity] IN ('common', 'uncommon', 'rare', 'epic', 'legendary'))
)
GO

CREATE NONCLUSTERED INDEX [IX_crate_contents_item_rarity] ON [store].[crate_contents]([crate_item_id] ASC, [rarity] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_crate_contents_active] ON [store].[crate_contents]([is_active] ASC)
GO

-- Crate openings history
CREATE TABLE [store].[crate_openings](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [user_id] [uniqueidentifier] NOT NULL,
    [crate_item_id] [int] NOT NULL,
    [purchase_id] [bigint] NOT NULL,
    [item_goods_no] [int] NOT NULL,
    [item_name] [nvarchar](100) NOT NULL,
    [item_rarity] [nvarchar](20) NOT NULL,
    [quantity_received] [int] NOT NULL,
    [was_pity_drop] [bit] NULL DEFAULT 0,
    [opened_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_crate_openings] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_crate_openings_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_crate_openings_crate] FOREIGN KEY([crate_item_id]) REFERENCES [store].[items]([id]),
    CONSTRAINT [FK_crate_openings_purchase] FOREIGN KEY([purchase_id]) REFERENCES [store].[purchases]([id])
)
GO

CREATE NONCLUSTERED INDEX [IX_crate_openings_user] ON [store].[crate_openings]([user_id] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_crate_openings_crate] ON [store].[crate_openings]([crate_item_id] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_crate_openings_date] ON [store].[crate_openings]([opened_at] ASC)
GO

-- User crate history (for pity system)
CREATE TABLE [store].[user_crate_history](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [user_id] [uniqueidentifier] NOT NULL,
    [crate_item_id] [int] NOT NULL,
    [total_opens] [int] NULL DEFAULT 0,
    [opens_since_rare] [int] NULL DEFAULT 0,
    [opens_since_legendary] [int] NULL DEFAULT 0,
    [last_rare_at] [datetime2](7) NULL,
    [last_legendary_at] [datetime2](7) NULL,
    [updated_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_user_crate_history] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_user_crate_history] UNIQUE ([user_id], [crate_item_id]),
    CONSTRAINT [FK_user_crate_history_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_user_crate_history_crate] FOREIGN KEY([crate_item_id]) REFERENCES [store].[items]([id])
)
GO

-- Credit purchase history
CREATE TABLE [store].[user_credit_history](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [user_id] [uniqueidentifier] NOT NULL,
    [package_name] [nvarchar](100) NOT NULL,
    [credits_purchased] [int] NOT NULL,
    [bonus_credits] [int] NULL DEFAULT 0,
    [total_credits] [int] NOT NULL,
    [amount_paid] [decimal](10, 2) NOT NULL,
    [payment_method] [nvarchar](50) NULL DEFAULT 'credit_card',
    [transaction_id] [nvarchar](255) NULL,
    [status] [nvarchar](20) NULL DEFAULT 'completed',
    [purchased_at] [datetime2](7) NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_user_credit_history] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_user_credit_history_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id])
)
GO

-- ============================================
-- FORUM TABLES
-- ============================================

-- Forum categories
CREATE TABLE [forum].[categories](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [parent_id] [int] NULL,
    [slug] [nvarchar](64) NOT NULL,
    [name] [nvarchar](100) NOT NULL,
    [description] [nvarchar](300) NULL,
    [sort_order] [int] NOT NULL DEFAULT 0,
    [is_locked] [bit] NOT NULL DEFAULT 0,
    [is_announcement] [bit] NOT NULL DEFAULT 0,
    [created_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] [datetime2](7) NULL,
    [is_private] [bit] NOT NULL DEFAULT 0,
    CONSTRAINT [PK_categories] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_categories_slug] UNIQUE ([slug]),
    CONSTRAINT [FK_categories_parent] FOREIGN KEY([parent_id]) REFERENCES [forum].[categories]([id])
)
GO

-- Forum threads
CREATE TABLE [forum].[threads](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [category_id] [int] NOT NULL,
    [author_id] [uniqueidentifier] NOT NULL,
    [title] [nvarchar](200) NOT NULL,
    [content] [nvarchar](max) NOT NULL,
    [pinned] [bit] NOT NULL DEFAULT 0,
    [locked] [bit] NOT NULL DEFAULT 0,
    [deleted] [bit] NOT NULL DEFAULT 0,
    [view_count] [int] NOT NULL DEFAULT 0,
    [reply_count] [int] NOT NULL DEFAULT 0,
    [last_post_at] [datetime2](7) NULL,
    [last_post_user_id] [uniqueidentifier] NULL,
    [created_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] [datetime2](7) NULL,
    CONSTRAINT [PK_threads] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_threads_category] FOREIGN KEY([category_id]) REFERENCES [forum].[categories]([id]),
    CONSTRAINT [FK_threads_author] FOREIGN KEY([author_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_threads_last_user] FOREIGN KEY([last_post_user_id]) REFERENCES [store].[users]([id])
)
GO

CREATE NONCLUSTERED INDEX [IX_threads_category_last] ON [forum].[threads]([category_id] ASC, [pinned] DESC, [last_post_at] DESC)
GO
CREATE NONCLUSTERED INDEX [IX_threads_author] ON [forum].[threads]([author_id] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_threads_created] ON [forum].[threads]([created_at] DESC)
GO

-- Forum posts
CREATE TABLE [forum].[posts](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [thread_id] [bigint] NOT NULL,
    [author_id] [uniqueidentifier] NOT NULL,
    [content] [nvarchar](max) NOT NULL,
    [is_op] [bit] NOT NULL DEFAULT 0,
    [edited_at] [datetime2](7) NULL,
    [editor_id] [uniqueidentifier] NULL,
    [deleted] [bit] NOT NULL DEFAULT 0,
    [created_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    [edited] [bit] NOT NULL DEFAULT 0,
    CONSTRAINT [PK_posts] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_posts_thread] FOREIGN KEY([thread_id]) REFERENCES [forum].[threads]([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_posts_author] FOREIGN KEY([author_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_posts_editor] FOREIGN KEY([editor_id]) REFERENCES [store].[users]([id])
)
GO

CREATE NONCLUSTERED INDEX [IX_posts_thread_created] ON [forum].[posts]([thread_id] ASC, [created_at] ASC)
GO
CREATE NONCLUSTERED INDEX [IX_posts_author] ON [forum].[posts]([author_id] ASC, [created_at] DESC)
GO

-- Thread prefixes
CREATE TABLE [forum].[prefixes](
    [id] [int] IDENTITY(1,1) NOT NULL,
    [name] [nvarchar](50) NOT NULL,
    [type] [nvarchar](20) NOT NULL,
    [color] [nvarchar](50) NOT NULL,
    [text_color] [nvarchar](50) NOT NULL,
    CONSTRAINT [PK_prefixes] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [UQ_prefixes_name] UNIQUE ([name])
)
GO

CREATE TABLE [forum].[thread_prefixes](
    [thread_id] [bigint] NOT NULL,
    [prefix_id] [int] NOT NULL,
    CONSTRAINT [PK_thread_prefixes] PRIMARY KEY CLUSTERED ([thread_id] ASC, [prefix_id] ASC),
    CONSTRAINT [FK_thread_prefixes_thread] FOREIGN KEY([thread_id]) REFERENCES [forum].[threads]([id]) ON DELETE CASCADE,
    CONSTRAINT [FK_thread_prefixes_prefix] FOREIGN KEY([prefix_id]) REFERENCES [forum].[prefixes]([id]) ON DELETE CASCADE
)
GO

-- User sanctions (bans/timeouts)
CREATE TABLE [forum].[user_sanctions](
    [id] [bigint] IDENTITY(1,1) NOT NULL,
    [user_id] [uniqueidentifier] NOT NULL,
    [issued_by] [uniqueidentifier] NOT NULL,
    [type] [nvarchar](20) NOT NULL,
    [reason] [nvarchar](500) NOT NULL,
    [created_at] [datetime2](7) NOT NULL DEFAULT SYSUTCDATETIME(),
    [expires_at] [datetime2](7) NULL,
    [revoked_at] [datetime2](7) NULL,
    CONSTRAINT [PK_user_sanctions] PRIMARY KEY CLUSTERED ([id] ASC),
    CONSTRAINT [FK_sanctions_user] FOREIGN KEY([user_id]) REFERENCES [store].[users]([id]),
    CONSTRAINT [FK_sanctions_issuer] FOREIGN KEY([issued_by]) REFERENCES [store].[users]([id]),
    CONSTRAINT [CK_sanctions_type] CHECK ([type] IN ('timeout', 'ban'))
)
GO

CREATE NONCLUSTERED INDEX [IX_sanctions_user_active] ON [forum].[user_sanctions]([user_id] ASC, [type] ASC, [expires_at] ASC) WHERE ([revoked_at] IS NULL)
GO

-- ============================================
-- SAMPLE DATA
-- ============================================

-- Sample roles
INSERT INTO [store].[roles] ([name], [color]) VALUES
('Admin', 'rgb(126, 34, 206)'),
('Moderator', 'rgb(139, 92, 246)'),
('VIP', 'rgb(147, 51, 234)'),
('Member', 'rgb(156, 163, 175)');

-- Sample admin user (password: 'demo123')
INSERT INTO [store].[users] ([username], [email], [password_hash], [account_balance], [game_user_no]) VALUES
('DemoAdmin', 'admin@demo.com', '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8', 50000, 1);

-- Grant admin role
DECLARE @adminUserId UNIQUEIDENTIFIER = (SELECT id FROM [store].[users] WHERE username = 'DemoAdmin');
DECLARE @adminRoleId INT = (SELECT id FROM [store].[roles] WHERE name = 'Admin');
INSERT INTO [store].[user_roles] ([user_id], [role_id]) VALUES (@adminUserId, @adminRoleId);

-- Sample items
INSERT INTO [store].[items] ([name], [description], [goods_no], [price], [item_type]) VALUES
('Swift Mount', 'Increases movement speed by 150%', 10001, 5000, 'mounts'),
('Epic Mount', 'Increases movement speed by 200%', 10002, 8000, 'mounts'),
('Royal Costume', 'Look like royalty', 20001, 3000, 'costumes'),
('Health Potion x50', 'Restores 500 HP instantly', 30001, 500, 'consumables'),
('EXP Boost (30 days)', '+100% experience gain', 40001, 1500, 'buffs'),
('Legendary Crate', 'Contains random legendary weapon', 50001, 5000, 'crates'),
('Starter Bundle', 'Perfect for new players', 60001, 7500, 'bundles');

-- Sample forum categories
INSERT INTO [forum].[categories] ([slug], [name], [description], [sort_order], [is_announcement]) VALUES
('announcements', 'Announcements', 'Official server announcements', 1, 1),
('general', 'General Discussion', 'General game discussion', 2, 0),
('guides', 'Guides & Tips', 'Player guides and tips', 3, 0),
('support', 'Support', 'Get help with issues', 4, 0);

GO