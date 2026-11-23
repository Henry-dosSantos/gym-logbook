import DossierCore
import SwiftUI
import UIKit

/// The one screen: the whole log as plain text, with the suggestion bar riding above the keyboard.
struct EditorScreen: View {
    @EnvironmentObject private var log: LogModel
    @State private var acceptGhost: (@MainActor () -> Void)?

    var body: some View {
        LogEditor(log: log, acceptGhost: $acceptGhost)
            .safeAreaInset(edge: .bottom, spacing: 0) {
                SuggestionBar(suggestion: log.suggestion, saveError: log.saveError) { acceptGhost?() }
            }
            .background(Theme.background)
    }
}

/// UITextView wrapped for SwiftUI. Everything that could change the text by itself is off (autocorrect, smart
/// quotes and dashes, spell checking): the text is the source of truth and the app never rewrites it.
struct LogEditor: UIViewRepresentable {
    let log: LogModel
    @Binding var acceptGhost: (@MainActor () -> Void)?

    func makeUIView(context: Context) -> UITextView {
        let view = UITextView()
        view.delegate = context.coordinator
        view.backgroundColor = Theme.uiBackground
        view.textColor = Theme.uiText
        view.tintColor = Theme.uiText
        view.font = Theme.mono(Theme.editorSize)
        view.autocorrectionType = .no
        view.autocapitalizationType = .sentences
        view.spellCheckingType = .no
        view.smartQuotesType = .no
        view.smartDashesType = .no
        view.smartInsertDeleteType = .no
        view.inlinePredictionType = .no
        view.keyboardAppearance = .dark
        view.alwaysBounceVertical = true
        view.keyboardDismissMode = .interactive
        view.textContainerInset = UIEdgeInsets(top: 8, left: 20, bottom: 104, right: 20)
        view.typingAttributes = Coordinator.attributes
        view.attributedText = NSAttributedString(string: log.text, attributes: Coordinator.attributes)
        context.coordinator.view = view
        let coordinator = context.coordinator
        Task { @MainActor in
            // Set after this update pass: SwiftUI state must not change while a view is being made.
            acceptGhost = { [weak coordinator] in coordinator?.accept() }
        }
        return view
    }

    func updateUIView(_ view: UITextView, context: Context) {
        // The text view owns the text while editing; the model only mirrors it. Nothing to push back here.
    }

    func makeCoordinator() -> Coordinator { Coordinator(log: log) }

    @MainActor
    final class Coordinator: NSObject, UITextViewDelegate {
        static let attributes: [NSAttributedString.Key: Any] = {
            let paragraph = NSMutableParagraphStyle()
            paragraph.lineHeightMultiple = Theme.lineHeightMultiple
            return [.font: Theme.mono(Theme.editorSize), .foregroundColor: Theme.uiText, .paragraphStyle: paragraph]
        }()

        let log: LogModel
        weak var view: UITextView?
        private var accepting = false

        init(log: LogModel) { self.log = log }

        private func cursor(_ view: UITextView) -> (head: Int, empty: Bool) {
            let r = view.selectedRange
            return (r.location + r.length, r.length == 0)
        }

        func textViewDidChange(_ view: UITextView) {
            let c = cursor(view)
            log.textDidChange(view.text, cursor: c.head, selectionEmpty: c.empty)
        }

        func textViewDidChangeSelection(_ view: UITextView) {
            let c = cursor(view)
            log.selectionDidChange(cursor: c.head, selectionEmpty: c.empty)
        }

        /// Enter accepts the ghost (else breaks the line), Space accepts ghosts marked `space`, and Backspace on
        /// an empty line hides the ghost: the same keys as the web editor.
        func textView(_ view: UITextView, shouldChangeTextIn range: NSRange, replacementText text: String) -> Bool {
            if accepting || view.markedTextRange != nil || range.length > 1 { return true }
            let ghost = log.suggestion.ghost
            if range.length == 0, let ghost {
                if text == "\n" || (text == " " && ghost.space) {
                    accept()
                    return false
                }
            }
            if text.isEmpty && range.length == 1 {
                let caret = range.location + 1
                let ns = view.text as NSString
                let line = ns.lineRange(for: NSRange(location: caret, length: 0))
                let lineText = ns.substring(with: line).trimmingCharacters(in: .newlines)
                if lineText.isEmpty && log.dismissGhost(lineIsEmpty: true) { return false }
            }
            return true
        }

        /// Inserts the ghost at the cursor as if typed, so Undo removes it in one step.
        func accept() {
            guard let view, let ghost = log.suggestion.ghost, view.selectedRange.length == 0 else { return }
            accepting = true
            view.insertText(ghost.text)
            accepting = false
            // TODO(Mac): a light haptic here (UIImpactFeedbackGenerator), and the brief "accepted" highlight the
            // web editor shows (.cm-accepted).
        }
    }
}

/// Above the keyboard: the ghost (tap to accept) and the last two sessions of the exercise on this line.
/// A stand-in for the web's inline ghost text, which needs TextKit work on the Mac (see ios/README.md).
struct SuggestionBar: View {
    let suggestion: Suggestion
    let saveError: String?
    let accept: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if let saveError {
                Text(saveError).foregroundStyle(Theme.text)
            }
            if let ghost = suggestion.ghost {
                Button(action: accept) {
                    Text(ghost.text)
                        .foregroundStyle(Theme.ghost)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Accept suggestion \(ghost.text)")
            }
            ForEach(Array(suggestion.strip.enumerated()), id: \.offset) { _, item in
                HStack(spacing: 12) {
                    Text(item.date).foregroundStyle(Theme.secondary)
                    Text(item.sets).foregroundStyle(Theme.text)
                }
            }
        }
        .font(Theme.monoFont(13))
        .lineLimit(1)
        .padding(.horizontal, 20)
        .padding(.vertical, suggestion.ghost == nil && suggestion.strip.isEmpty && saveError == nil ? 0 : 8)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.background.opacity(0.6))
        .overlay(alignment: .top) {
            if suggestion.ghost != nil || !suggestion.strip.isEmpty { Theme.hairline.frame(height: 0.5) }
        }
    }
}
