import SwiftUI

/// A list of notes that can be searched.
struct NotesView: View {
    @State private var query = ""
    @StateObject private var store = NoteStore()

    var filtered: [Note] {
        query.isEmpty ? store.notes : store.notes.filter { $0.title.localizedCaseInsensitiveContains(query) }
    }

    var body: some View {
        NavigationStack {
            List(filtered) { note in
                VStack(alignment: .leading, spacing: 4) {
                    Text(note.title).font(.headline)
                    Text("Edited \(note.updated, style: .relative) ago")
                        .foregroundStyle(.secondary)
                }
            }
            .searchable(text: $query)
            .task { await store.load() }
        }
    }
}

@MainActor
final class NoteStore: ObservableObject {
    @Published private(set) var notes: [Note] = []

    func load() async {
        guard let url = URL(string: "https://example.com/notes.json") else { return }
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            notes = try JSONDecoder().decode([Note].self, from: data)
        } catch {
            print("failed: \(error)")
        }
    }
}
