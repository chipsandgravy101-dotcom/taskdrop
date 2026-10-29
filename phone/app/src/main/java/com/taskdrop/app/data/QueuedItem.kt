package com.taskdrop.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "queued_items")
data class QueuedItem(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val text: String,
    val non_skippable: Boolean = false,
    val created_at: String,
    val status: String = STATUS_QUEUED,
    val sent_at: String? = null,
) {
    companion object {
        const val STATUS_QUEUED = "queued"
        const val STATUS_SENT = "sent"
    }
}
