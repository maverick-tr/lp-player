import Cocoa
import Foundation

/// LP Player macOS Launcher
/// Starts the embedded Node.js server binary, opens the browser,
/// and maintains a proper Dock presence via NSApplication.

class AppDelegate: NSObject, NSApplicationDelegate {
    var serverProcess: Process?
    var statusItem: NSStatusItem?

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Find the embedded binary next to this launcher
        let bundle = Bundle.main
        let resourcePath = bundle.resourcePath ?? bundle.bundlePath + "/Contents/Resources"
        let binaryPath = resourcePath + "/lp-player"

        guard FileManager.default.fileExists(atPath: binaryPath) else {
            let alert = NSAlert()
            alert.messageText = "LP Player"
            alert.informativeText = "Could not find the server binary at:\n\(binaryPath)"
            alert.alertStyle = .critical
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        // Start the server process
        let process = Process()
        process.executableURL = URL(fileURLWithPath: binaryPath)
        process.arguments = ["--host", "localhost", "--port", "4243"]
        process.currentDirectoryURL = URL(fileURLWithPath: resourcePath)

        // Suppress server stdout/stderr from appearing in Console.app noise
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice

        process.terminationHandler = { proc in
            DispatchQueue.main.async {
                if proc.terminationStatus != 0 && proc.terminationStatus != 15 {
                    let alert = NSAlert()
                    alert.messageText = "LP Player"
                    alert.informativeText = "Server exited with code \(proc.terminationStatus)"
                    alert.alertStyle = .warning
                    alert.runModal()
                }
                NSApp.terminate(nil)
            }
        }

        do {
            try process.run()
            serverProcess = process
        } catch {
            let alert = NSAlert()
            alert.messageText = "LP Player"
            alert.informativeText = "Failed to start server:\n\(error.localizedDescription)"
            alert.alertStyle = .critical
            alert.runModal()
            NSApp.terminate(nil)
            return
        }

        // server.cjs handles opening Chrome in --app mode automatically
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return false
    }

    func applicationWillTerminate(_ notification: Notification) {
        // Gracefully stop the server
        if let process = serverProcess, process.isRunning {
            process.terminate()
            // Give it a moment to shut down gracefully
            DispatchQueue.global().async {
                usleep(500_000) // 500ms
                if process.isRunning {
                    process.interrupt()
                }
            }
        }
    }
}

// --- Entry point ---
let delegate = AppDelegate()
let app = NSApplication.shared
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
