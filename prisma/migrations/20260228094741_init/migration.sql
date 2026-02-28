-- CreateEnum
CREATE TYPE "MembershipPlan" AS ENUM ('FREE', 'PRO', 'TEAM');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELED', 'TRIALING');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('NOTION');

-- CreateEnum
CREATE TYPE "PublishAccess" AS ENUM ('PUBLIC', 'PASSWORD', 'PRIVATE');

-- CreateEnum
CREATE TYPE "BillingEventType" AS ENUM ('MEMBERSHIP_CREATED', 'MEMBERSHIP_UPDATED', 'MEMBERSHIP_CANCELED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'MANUAL_GRANT');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "authUserId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "avatar" TEXT,
    "timezone" TEXT DEFAULT 'Asia/Shanghai',
    "locale" TEXT DEFAULT 'zh-CN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "MembershipPlan" NOT NULL DEFAULT 'FREE',
    "status" "MembershipStatus" NOT NULL DEFAULT 'ACTIVE',
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3),
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotionSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageTitle" TEXT,
    "accessType" TEXT DEFAULT 'public-page',
    "rawMetaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotionSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartProject" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notionSourceId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'NOTION',
    "notionPageId" TEXT,
    "chartType" TEXT NOT NULL,
    "configJson" JSONB NOT NULL,
    "themeJson" JSONB,
    "publishOptionsJson" JSONB,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublishedChart" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "access" "PublishAccess" NOT NULL DEFAULT 'PUBLIC',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "snapshotJson" JSONB NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PublishedChart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "membershipId" TEXT,
    "eventType" "BillingEventType" NOT NULL,
    "payloadJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_authUserId_key" ON "User"("authUserId");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Membership_userId_status_idx" ON "Membership"("userId", "status");

-- CreateIndex
CREATE INDEX "NotionSource_pageId_idx" ON "NotionSource"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "NotionSource_userId_pageId_key" ON "NotionSource"("userId", "pageId");

-- CreateIndex
CREATE INDEX "ChartProject_userId_isDeleted_idx" ON "ChartProject"("userId", "isDeleted");

-- CreateIndex
CREATE INDEX "ChartProject_notionPageId_idx" ON "ChartProject"("notionPageId");

-- CreateIndex
CREATE UNIQUE INDEX "PublishedChart_slug_key" ON "PublishedChart"("slug");

-- CreateIndex
CREATE INDEX "PublishedChart_userId_idx" ON "PublishedChart"("userId");

-- CreateIndex
CREATE INDEX "PublishedChart_projectId_idx" ON "PublishedChart"("projectId");

-- CreateIndex
CREATE INDEX "PublishedChart_slug_idx" ON "PublishedChart"("slug");

-- CreateIndex
CREATE INDEX "BillingEvent_userId_createdAt_idx" ON "BillingEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingEvent_membershipId_idx" ON "BillingEvent"("membershipId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotionSource" ADD CONSTRAINT "NotionSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartProject" ADD CONSTRAINT "ChartProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartProject" ADD CONSTRAINT "ChartProject_notionSourceId_fkey" FOREIGN KEY ("notionSourceId") REFERENCES "NotionSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedChart" ADD CONSTRAINT "PublishedChart_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublishedChart" ADD CONSTRAINT "PublishedChart_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ChartProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingEvent" ADD CONSTRAINT "BillingEvent_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE SET NULL ON UPDATE CASCADE;
