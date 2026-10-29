package com.taskdrop.app.ui

import android.Manifest
import android.content.pm.PackageManager
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.taskdrop.app.data.AppDatabase
import com.taskdrop.app.data.QueuedItem
import com.taskdrop.app.network.DesktopClient
import com.taskdrop.app.network.SyncWorker
import com.taskdrop.app.voice.VoiceInput
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen() {
    val context = LocalContext.current
    val database = remember { AppDatabase.getInstance(context) }
    val dao = remember { database.queuedItemDao() }
    val syncWorker = remember { SyncWorker(context, dao) }
    val desktopClient = remember { DesktopClient(context) }
    val coroutineScope = rememberCoroutineScope()
    val lifecycleOwner = LocalLifecycleOwner.current
    val queuedItems by dao.observeQueuedItems().collectAsStateWithLifecycle(initialValue = emptyList())
    var taskText by remember { mutableStateOf("") }
    var nonSkippable by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var serverAddress by remember { mutableStateOf(desktopClient.getServerAddress()) }
    var settingsError by remember { mutableStateOf<String?>(null) }
    val voiceInput = remember(context) { VoiceInput(context) }

    DisposableEffect(voiceInput) {
        onDispose { voiceInput.destroy() }
    }

    LaunchedEffect(lifecycleOwner, syncWorker) {
        lifecycleOwner.lifecycle.repeatOnLifecycle(Lifecycle.State.STARTED) {
            syncWorker.syncQueuedItems()
            while (true) {
                delay(SYNC_INTERVAL_MILLIS)
                syncWorker.syncQueuedItems()
            }
        }
    }

    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission(),
    ) { granted ->
        if (granted) {
            voiceInput.start(
                onText = { taskText = it },
                onUnavailable = { showVoiceUnavailable(context) },
            )
        } else {
            showVoiceUnavailable(context)
        }
    }

    fun startVoiceInput() {
        if (ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        ) {
            voiceInput.start(
                onText = { taskText = it },
                onUnavailable = { showVoiceUnavailable(context) },
            )
        } else {
            permissionLauncher.launch(Manifest.permission.RECORD_AUDIO)
        }
    }

    fun enqueueTask() {
        val text = taskText.trim()
        if (text.isEmpty()) return
        coroutineScope.launch {
            val item = QueuedItem(
                text = text,
                non_skippable = nonSkippable,
                created_at = Instant.now().toString(),
            )
            val id = withContext(Dispatchers.IO) { dao.insert(item) }
            taskText = ""
            nonSkippable = false
            syncWorker.syncItem(item.copy(id = id))
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("TaskDrop") },
                actions = {
                    IconButton(onClick = {
                        serverAddress = desktopClient.getServerAddress()
                        settingsError = null
                        showSettings = true
                    }) {
                        Icon(Icons.Default.Settings, contentDescription = "Connection settings")
                    }
                },
            )
        },
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                text = "Capture a task",
                style = MaterialTheme.typography.headlineSmall,
            )
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                OutlinedTextField(
                    value = taskText,
                    onValueChange = { taskText = it },
                    label = { Text("What do you need to do?") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                )
                Spacer(Modifier.width(6.dp))
                IconButton(onClick = { startVoiceInput() }) {
                    Icon(Icons.Default.Mic, contentDescription = "Speak a task")
                }
            }
            Row(
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Checkbox(
                    checked = nonSkippable,
                    onCheckedChange = { nonSkippable = it },
                )
                Text("Non-skippable")
                Spacer(Modifier.weight(1f))
                Button(
                    onClick = { enqueueTask() },
                    enabled = taskText.isNotBlank(),
                ) {
                    Text("Send")
                }
            }

            if (queuedItems.isNotEmpty()) {
                Spacer(Modifier.height(4.dp))
                QueuedListSection(
                    items = queuedItems,
                    onRetry = { item -> coroutineScope.launch { syncWorker.syncItem(item) } },
                    onDelete = { item ->
                        coroutineScope.launch {
                            withContext(Dispatchers.IO) { dao.deleteQueued(item.id) }
                        }
                    },
                    modifier = Modifier.weight(1f),
                )
            }
        }
    }

    if (showSettings) {
        AlertDialog(
            onDismissRequest = { showSettings = false },
            title = { Text("Desktop connection") },
            text = {
                Column {
                    Text("Enter the desktop IP address and port.")
                    Spacer(Modifier.height(10.dp))
                    OutlinedTextField(
                        value = serverAddress,
                        onValueChange = {
                            serverAddress = it
                            settingsError = null
                        },
                        label = { Text("IP address:port") },
                        singleLine = true,
                        isError = settingsError != null,
                    )
                    settingsError?.let {
                        Text(
                            text = it,
                            color = MaterialTheme.colorScheme.error,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    if (!desktopClient.isValidServerAddress(serverAddress)) {
                        settingsError = "Enter a valid address, such as 192.168.68.105:3000."
                    } else {
                        desktopClient.saveServerAddress(serverAddress)
                        showSettings = false
                        coroutineScope.launch { syncWorker.syncQueuedItems() }
                    }
                }) {
                    Text("Save")
                }
            },
            dismissButton = {
                OutlinedButton(onClick = { showSettings = false }) {
                    Text("Cancel")
                }
            },
        )
    }
}

private fun showVoiceUnavailable(context: android.content.Context) {
    Toast.makeText(context, "Voice input unavailable — please type.", Toast.LENGTH_SHORT).show()
}

private const val SYNC_INTERVAL_MILLIS = 30_000L
