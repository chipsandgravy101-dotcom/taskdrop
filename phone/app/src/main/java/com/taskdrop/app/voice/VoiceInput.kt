package com.taskdrop.app.voice

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

class VoiceInput(context: Context) {
    private val appContext = context.applicationContext
    private var recognizer: SpeechRecognizer? = null

    fun start(onText: (String) -> Unit, onUnavailable: () -> Unit) {
        if (!SpeechRecognizer.isOnDeviceRecognitionAvailable(appContext)) {
            onUnavailable()
            return
        }

        destroyRecognizer()
        try {
            recognizer = SpeechRecognizer.createOnDeviceSpeechRecognizer(appContext).also { service ->
                service.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) = Unit
                    override fun onBeginningOfSpeech() = Unit
                    override fun onRmsChanged(rmsdB: Float) = Unit
                    override fun onBufferReceived(buffer: ByteArray?) = Unit
                    override fun onEndOfSpeech() = Unit
                    override fun onEvent(eventType: Int, params: Bundle?) = Unit

                    override fun onError(error: Int) {
                        onUnavailable()
                        destroyRecognizer()
                    }

                    override fun onResults(results: Bundle?) {
                        val recognized = results
                            ?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                            ?.firstOrNull()
                        if (recognized.isNullOrBlank()) {
                            onUnavailable()
                        } else {
                            onText(recognized)
                        }
                        destroyRecognizer()
                    }

                    override fun onPartialResults(partialResults: Bundle?) = Unit
                })
                val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                    putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault())
                    putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
                }
                service.startListening(intent)
            }
        } catch (_: RuntimeException) {
            destroyRecognizer()
            onUnavailable()
        }
    }

    fun destroy() {
        destroyRecognizer()
    }

    private fun destroyRecognizer() {
        recognizer?.destroy()
        recognizer = null
    }
}
