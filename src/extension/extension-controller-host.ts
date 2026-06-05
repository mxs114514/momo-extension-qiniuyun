import type { SpeechTranslationSnapshot } from '../features/speech-translation/types'
import type { ExtensionCommand, ExtensionEvent } from './messaging'

interface HostController {
  start: () => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => Promise<void>
  getSnapshot: () => SpeechTranslationSnapshot
  subscribe: (listener: () => void) => () => void
}

interface HostDependencies {
  createController: () => HostController
  sendEvent: (event: ExtensionEvent) => void
}

export class ExtensionControllerHost {
  private readonly createController: HostDependencies['createController']
  private readonly sendEvent: HostDependencies['sendEvent']
  private controller: HostController | null = null
  private unsubscribe: (() => void) | null = null

  constructor(dependencies: HostDependencies) {
    this.createController = dependencies.createController
    this.sendEvent = dependencies.sendEvent
  }

  async handleCommand(command: ExtensionCommand): Promise<void> {
    try {
      switch (command.type) {
        case 'speech/start':
          await this.start()
          break
        case 'speech/pause':
          await this.controller?.pause()
          break
        case 'speech/resume':
          await this.controller?.resume()
          break
        case 'speech/stop':
          await this.stop()
          break
        case 'speech/get-snapshot':
          this.emitSnapshot()
          break
      }
    } catch (error) {
      await this.cleanup()
      this.sendEvent({
        type: 'speech/error',
        message: error instanceof Error ? error.message : '扩展控制器执行失败',
      })
    }
  }

  private async start(): Promise<void> {
    if (this.controller) return

    this.controller = this.createController()
    this.unsubscribe = this.controller.subscribe(() => this.emitSnapshot())
    await this.controller.start()
  }

  private async stop(): Promise<void> {
    if (!this.controller) return

    await this.controller.stop()
    await this.cleanup()
  }

  private async cleanup(): Promise<void> {
    this.unsubscribe?.()
    this.unsubscribe = null
    const controller = this.controller
    this.controller = null
    await controller?.dispose()
  }

  private emitSnapshot(): void {
    if (!this.controller) return

    this.sendEvent({
      type: 'speech/snapshot',
      snapshot: this.controller.getSnapshot(),
    })
  }
}
