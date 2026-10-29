package com.taskdrop.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.taskdrop.app.ui.MainScreen
import com.taskdrop.app.ui.TaskDropTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TaskDropTheme {
                MainScreen()
            }
        }
    }
}
