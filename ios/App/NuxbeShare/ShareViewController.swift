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
            group.enter()

            // Runs once per provider, from whichever of the two loaders matched.
            let store: (URL, String?, String?) -> Void = { url, typeId, suggestedName in
                defer { group.leave() }

                lock.lock()
                let fileIndex = index
                index += 1
                lock.unlock()

                guard let entry = self.copyIntoInbox(
                    from: url,
                    inbox: inbox,
                    stamp: stamp,
                    fileIndex: fileIndex,
                    typeId: typeId,
                    suggestedName: suggestedName
                ) else { return }

                lock.lock()
                meta.append(entry)
                lock.unlock()
            }

            if let typeId = contentTypeIdentifier(for: provider) {
                provider.loadFileRepresentation(forTypeIdentifier: typeId) { url, _ in
                    guard let url else {
                        group.leave()
                        return
                    }
                    store(url, typeId, provider.suggestedName)
                }
            } else if provider.hasItemConformingToTypeIdentifier(UTType.fileURL.identifier) {
                // Nothing but a file reference on offer. Resolve it to the real
                // document rather than letting the URL itself be materialised.
                provider.loadItem(forTypeIdentifier: UTType.fileURL.identifier, options: nil) { item, _ in
                    guard let url = Self.fileURL(from: item) else {
                        group.leave()
                        return
                    }

                    let scoped = url.startAccessingSecurityScopedResource()
                    defer {
                        if scoped {
                            url.stopAccessingSecurityScopedResource()
                        }
                    }

                    store(url, nil, provider.suggestedName)
                }
            } else {
                group.leave()
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

    /// Copies `url` into the inbox and returns the metadata entry for it.
    private func copyIntoInbox(
        from url: URL,
        inbox: URL,
        stamp: Int,
        fileIndex: Int,
        typeId: String?,
        suggestedName: String?
    ) -> [String: Any]? {
        let fileManager = FileManager.default

        // The provider's suggested name is the document name; the url may be a
        // temporary copy whose name says nothing about the original.
        let sourceExtension = url.pathExtension
        var displayName = suggestedName ?? url.lastPathComponent
        if (displayName as NSString).pathExtension.isEmpty && !sourceExtension.isEmpty {
            displayName += ".\(sourceExtension)"
        }

        let sanitized = displayName.replacingOccurrences(
            of: "[^a-zA-Z0-9._-]",
            with: "_",
            options: .regularExpression
        )
        let target = inbox.appendingPathComponent("\(stamp)_\(fileIndex)_\(sanitized)")

        do {
            // The source url is only valid inside the loader callback - copy synchronously
            try fileManager.copyItem(at: url, to: target)
        } catch {
            return nil
        }

        let size = ((try? fileManager.attributesOfItem(atPath: target.path)[.size] as? NSNumber) ?? nil)?.intValue ?? 0
        let mimeType = UTType(filenameExtension: (sanitized as NSString).pathExtension)?.preferredMIMEType
            ?? typeId.flatMap { UTType($0)?.preferredMIMEType }
            ?? "application/octet-stream"

        return [
            "name": displayName,
            "mimeType": mimeType,
            "size": size,
            "path": target.lastPathComponent,
        ]
    }

    /// The identifier whose file representation is the document itself.
    ///
    /// `public.file-url` must never be returned here: its representation is the
    /// URL, so `loadFileRepresentation` writes a temp file holding the path
    /// instead of the document. Conformance alone is not a safe test either,
    /// because `public.file-url` conforms to `public.url` and through it to
    /// `public.data`, so asking for `public.data` hits the same trap.
    private func contentTypeIdentifier(for provider: NSItemProvider) -> String? {
        let concrete = provider.registeredTypeIdentifiers.filter { identifier in
            guard let type = UTType(identifier) else { return false }
            return type.conforms(to: .data) && !type.conforms(to: .url)
        }

        for preferred in [UTType.pdf, UTType.image] {
            if let match = concrete.first(where: { UTType($0)?.conforms(to: preferred) == true }) {
                return match
            }
        }

        return concrete.first
    }

    private static func fileURL(from item: NSSecureCoding?) -> URL? {
        if let url = item as? URL {
            return url.isFileURL ? url : nil
        }

        // Some providers hand the url over as its data representation
        if let data = item as? Data, let url = URL(dataRepresentation: data, relativeTo: nil) {
            return url.isFileURL ? url : nil
        }

        return nil
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
