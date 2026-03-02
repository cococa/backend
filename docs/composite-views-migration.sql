begin;

create table if not exists "CompositeView" (
  "id" text not null,
  "userId" text not null,
  "name" text not null,
  "description" text,
  "layoutJson" jsonb not null,
  "themeJson" jsonb,
  "isDeleted" boolean not null default false,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  constraint "CompositeView_pkey" primary key ("id")
);

alter table "CompositeView"
  drop constraint if exists "CompositeView_userId_fkey";

alter table "CompositeView"
  add constraint "CompositeView_userId_fkey"
  foreign key ("userId") references "User"("id")
  on delete cascade
  on update cascade;

create index if not exists "CompositeView_userId_isDeleted_idx"
  on "CompositeView" ("userId", "isDeleted");

create table if not exists "PublishedCompositeView" (
  "id" text not null,
  "compositeId" text not null,
  "userId" text not null,
  "slug" text not null,
  "title" text not null,
  "description" text,
  "access" "PublishAccess" not null default 'PUBLIC',
  "isPublic" boolean not null default true,
  "passwordHash" text,
  "snapshotJson" jsonb not null,
  "viewCount" integer not null default 0,
  "createdAt" timestamp(3) not null default current_timestamp,
  "updatedAt" timestamp(3) not null,
  "publishedAt" timestamp(3) default current_timestamp,
  constraint "PublishedCompositeView_pkey" primary key ("id"),
  constraint "PublishedCompositeView_slug_key" unique ("slug")
);

alter table "PublishedCompositeView"
  drop constraint if exists "PublishedCompositeView_userId_fkey";

alter table "PublishedCompositeView"
  add constraint "PublishedCompositeView_userId_fkey"
  foreign key ("userId") references "User"("id")
  on delete cascade
  on update cascade;

alter table "PublishedCompositeView"
  drop constraint if exists "PublishedCompositeView_compositeId_fkey";

alter table "PublishedCompositeView"
  add constraint "PublishedCompositeView_compositeId_fkey"
  foreign key ("compositeId") references "CompositeView"("id")
  on delete cascade
  on update cascade;

create index if not exists "PublishedCompositeView_userId_idx"
  on "PublishedCompositeView" ("userId");

create index if not exists "PublishedCompositeView_compositeId_idx"
  on "PublishedCompositeView" ("compositeId");

create index if not exists "PublishedCompositeView_slug_idx"
  on "PublishedCompositeView" ("slug");

commit;
