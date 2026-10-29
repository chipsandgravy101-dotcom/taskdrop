package com.taskdrop.app.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface QueuedItemDao {
    @Query("SELECT * FROM queued_items WHERE status = 'queued' ORDER BY created_at ASC, id ASC")
    fun observeQueuedItems(): Flow<List<QueuedItem>>

    @Query("SELECT * FROM queued_items WHERE status = 'queued' ORDER BY created_at ASC, id ASC")
    suspend fun getQueuedItems(): List<QueuedItem>

    @Query("SELECT * FROM queued_items WHERE id = :id LIMIT 1")
    suspend fun getById(id: Long): QueuedItem?

    @Insert
    suspend fun insert(item: QueuedItem): Long

    @Query("UPDATE queued_items SET status = 'sent', sent_at = :sentAt WHERE id = :id AND status = 'queued'")
    suspend fun markSent(id: Long, sentAt: String): Int

    @Query("DELETE FROM queued_items WHERE id = :id AND status = 'queued'")
    suspend fun deleteQueued(id: Long): Int
}
