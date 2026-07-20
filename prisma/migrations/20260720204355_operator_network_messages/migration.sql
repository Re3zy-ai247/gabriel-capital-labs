-- CreateTable
CREATE TABLE "NetworkMessage" (
    "id" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isKai" BOOLEAN NOT NULL DEFAULT false,
    "audienceAgencyId" TEXT,
    "clientMsgId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetworkMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkMessageReadState" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channelKey" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,
    "lastReadMessageId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetworkMessageReadState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NetworkMessage_channelKey_createdAt_id_idx" ON "NetworkMessage"("channelKey", "createdAt", "id");

-- CreateIndex
CREATE INDEX "NetworkMessage_audienceAgencyId_idx" ON "NetworkMessage"("audienceAgencyId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkMessage_authorId_clientMsgId_key" ON "NetworkMessage"("authorId", "clientMsgId");

-- CreateIndex
CREATE INDEX "NetworkMessageReadState_userId_idx" ON "NetworkMessageReadState"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NetworkMessageReadState_userId_channelKey_key" ON "NetworkMessageReadState"("userId", "channelKey");

-- AddForeignKey
ALTER TABLE "NetworkMessage" ADD CONSTRAINT "NetworkMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkMessageReadState" ADD CONSTRAINT "NetworkMessageReadState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

