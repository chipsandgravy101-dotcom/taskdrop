package com.taskdrop.app.network

import android.content.Context
import android.util.Log
import com.taskdrop.app.data.QueuedItem
import com.taskdrop.app.data.QueuedItemDao
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.io.IOException
import java.time.Instant

class SyncWorker(context: Context, private val dao: QueuedItemDao) {
    private val client = DesktopClient(context.applicationContext)
    private val syncMutex = Mutex()

    suspend fun syncQueuedItems() = withContext(Dispatchers.IO) {
        syncMutex.withLock {
            for (item in dao.getQueuedItems()) {
                if (!syncOne(item)) {
                    break
                }
            }
        }
    }

    suspend fun syncItem(item: QueuedItem) = withContext(Dispatchers.IO) {
        syncMutex.withLock {
            syncOne(item)
        }
    }

    suspend fun syncItem(id: Long) = withContext(Dispatchers.IO) {
        syncMutex.withLock {
            val item = dao.getById(id) ?: return@withLock
            syncOne(item)
        }
    }

    private suspend fun syncOne(item: QueuedItem): Boolean {
        if (item.status != QueuedItem.STATUS_QUEUED) return true
        try {
            if (!client.isHealthy()) {
                Log.w(TAG, "Desktop health check failed; leaving item ${item.id} queued")
                return false
            }
            if (!client.sendItem(item)) {
                return false
            }
            dao.markSent(item.id, Instant.now().toString())
            return true
        } catch (error: IOException) {
            Log.w(TAG, "Could not sync item ${item.id}; it remains queued", error)
            return false
        } catch (error: IllegalArgumentException) {
            Log.w(TAG, "Could not sync item ${item.id}; it remains queued", error)
            return false
        }
    }

    companion object {
        private const val TAG = "TaskDropSync"
    }
}
