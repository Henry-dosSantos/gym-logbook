import DossierCore
import DossierStore
import Foundation

/// Holds the log text (the source of truth), parses it, asks DossierCore what to suggest at the cursor, and saves
/// the text to a file. It never rewrites the user's text: the only insertions are ghosts the user accepts.
@MainActor
final class LogModel: ObservableObject {
    @Published private(set) var text: String
    @Published private(set) var suggestion = Suggestion(ghost: nil, strip: [])
    @Published private(set) var settings: Settings
    @Published private(set) var saveError: String?

    private var doc: Doc
    private let store: TextStore?
    private var saveTask: Task<Void, Never>?
    private var dirty = false
    /// Cursor offset where the user dismissed the ghost (Backspace on an empty line), as on the web.
    private var dismissedAt: Int?
    private var cursor = 0
    private var selectionEmpty = true

    init() {
        let store = try? TextStore.applicationSupport()
        self.store = store
        let text = (try? store?.load("text")) ?? nil
        self.text = text ?? ""
        var settings = defaultSettings
        if let data = (try? store?.loadData("settings")) ?? nil,
           let saved = try? JSONDecoder().decode(Settings.self, from: data) {
            settings = saved
        }
        self.settings = settings
        doc = parseDoc(text ?? "")
    }

    // MARK: Editing

    /// The text view's text changed (typing, paste, undo, an accepted ghost).
    func textDidChange(_ newText: String, cursor: Int, selectionEmpty: Bool) {
        text = newText
        doc = parseDoc(newText)
        dirty = true
        dismissedAt = nil
        scheduleSave()
        selectionDidChange(cursor: cursor, selectionEmpty: selectionEmpty)
    }

    /// `cursor` is the selection head as a UTF-16 offset (UITextView's NSRange), which is what DossierCore uses.
    func selectionDidChange(cursor: Int, selectionEmpty: Bool) {
        self.cursor = cursor
        self.selectionEmpty = selectionEmpty
        let s = suggest(doc, cursor, settings, Date())
        suggestion = !selectionEmpty || dismissedAt == cursor ? Suggestion(ghost: nil, strip: s.strip) : s
    }

    /// Backspace on an empty line hides the ghost instead of deleting the line break. True when it did.
    func dismissGhost(lineIsEmpty: Bool) -> Bool {
        guard suggestion.ghost != nil, selectionEmpty, lineIsEmpty else { return false }
        dismissedAt = cursor
        suggestion = Suggestion(ghost: nil, strip: suggestion.strip)
        return true
    }

    func updateSettings(_ new: Settings) {
        settings = new
        if let data = try? JSONEncoder().encode(new) { try? store?.saveData("settings", data) }
        selectionDidChange(cursor: cursor, selectionEmpty: selectionEmpty)
    }

    // MARK: Saving

    private func scheduleSave() {
        saveTask?.cancel()
        saveTask = Task { [weak self] in
            try? await Task.sleep(for: .milliseconds(400))
            guard !Task.isCancelled else { return }
            self?.saveNow()
        }
    }

    func saveNow() {
        guard dirty, let store else { return }
        do {
            try store.save("text", text)
            dirty = false
            saveError = nil
        } catch {
            saveError = "Could not save: \(error.localizedDescription)"
        }
    }
}
