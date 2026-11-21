package com.acme.app.ui

import androidx.lifecycle.ViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

data class UiState(val items: List<String> = emptyList(), val loading: Boolean = false)

sealed interface Event {
    object Refresh : Event
    data class Search(val query: String) : Event
}

class ItemsViewModel(private val repository: ItemRepository) : ViewModel() {
    private val _state = MutableStateFlow(UiState())
    val state: StateFlow<UiState> = _state

    fun onEvent(event: Event) = when (event) {
        is Event.Refresh -> load()
        is Event.Search -> load(event.query.trim())
    }

    private fun load(query: String? = null) {
        _state.value = _state.value.copy(loading = true)
        val items = repository.items(query ?: "").filter { it.length > 2 }
        _state.value = UiState(items = items, loading = false)
        println("loaded ${items.size} items for '$query'")
    }

    companion object {
        const val PAGE_SIZE = 50
    }
}
