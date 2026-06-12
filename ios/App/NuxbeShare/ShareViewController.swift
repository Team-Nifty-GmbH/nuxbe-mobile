import UIKit
import UniformTypeIdentifiers

/// Share extension: receives files/images from the share sheet, copies them
/// into the app group inbox and hands off to the main app, which moves them
/// into the Capacitor cache for the Flux share target page (see AppDelegate).
class ShareViewController: UIViewController {

    private let appGroupId = "group.com.teamnifty.nuxbe"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear
        processAttachments()
    }

    private func processAttachments() {
        let providers = (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] } ?? []

        let fileManager = FileManager.default

        guard !providers.isEmpty,
              let container = fileManager.containerURL(forSecurityApplicationGroupIdentifier: appGroupId) else {
            complete()
            return
        }

        let inbox = container.appendingPathComponent("share_inbox", isDirectory: true)
        try? fileManager.removeItem(at: inbox)
        try? fileManager.createDirectory(at: inbox, withIntermediateDirectories: true)

        let stamp = Int(Date().timeIntervalSince1970 * 1000)
        let group = DispatchGroup()
        let lock = NSLock()
        var meta: [[String: Any]] = []
        var index = 0

        for provider in providers {
            guard let typeId = preferredTypeIdentifier(for: provider) else { continue }

            group.enter()
            provider.loadFileRepresentation(forTypeIdentifier: typeId) { url, _ in
                defer { group.leave() }
                guard let url else { return }

                lock.lock()
                let fileIndex = index
                index += 1
                lock.unlock()

                let sanitized = url.lastPathComponent.replacingOccurrences(
                    of: "[^a-zA-Z0-9._-]",
                    with: "_",
                    options: .regularExpression
                )
                let target = inbox.appendingPathComponent("\(stamp)_\(fileIndex)_\(sanitized)")

                do {
                    // The temporary url is only valid inside this callback - copy synchronously
                    try fileManager.copyItem(at: url, to: target)
                } catch {
                    return
                }

                let size = (try? fileManager.attributesOfItem(atPath: target.path)[.size] as? NSNumber)
                    .flatMap { $0 }?.intValue ?? 0
                let mimeType = UTType(typeId)?.preferredMIMEType
                    ?? UTType(filenameExtension: url.pathExtension)?.preferredMIMEType
                    ?? "application/octet-stream"

                lock.lock()
                meta.append([
                    "name": url.lastPathComponent,
                    "mimeType": mimeType,
                    "size": size,
                    "path": target.lastPathComponent,
                ])
                lock.unlock()
            }
        }

        group.notify(queue: .main) { [weak self] in
            guard let self else { return }

            if !meta.isEmpty,
               let data = try? JSONSerialization.data(withJSONObject: meta) {
                try? data.write(to: container.appendingPathComponent("share_inbox.json"))
                self.openMainApp()
            }

            self.complete()
        }
    }

    private func preferredTypeIdentifier(for provider: NSItemProvider) -> String? {
        // Prefer concrete file/image types; fall back to the first registered identifier
        for candidate in [UTType.fileURL.identifier, UTType.pdf.identifier, UTType.image.identifier, UTType.data.identifier] {
            if provider.hasItemConformingToTypeIdentifier(candidate) {
                return candidate
            }
        }

        return provider.registeredTypeIdentifiers.first
    }

    private func openMainApp() {
        guard let url = URL(string: "nuxbe://share-target") else { return }

        // UIApplication.shared is unavailable in extensions - walk the responder chain
        var responder: UIResponder? = self
        let selector = NSSelectorFromString("openURL:")

        while let current = responder {
            if current.responds(to: selector), current is UIApplication {
                current.perform(selector, with: url)

                return
            }
            responder = current.next
        }
    }

    private func complete() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
