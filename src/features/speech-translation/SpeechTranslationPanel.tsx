import type { SpeechTranslationController } from './speech-translation-controller'
import type { TranslationStatus } from './types'
import { useSpeechTranslation } from './use-speech-translation'

interface Props {
  controller: SpeechTranslationController
}

const statusLabels: Record<TranslationStatus, string> = {
  idle: '等待开始',
  'requesting-permission': '请求麦克风权限',
  connecting: '连接腾讯云',
  translating: '翻译中',
  paused: '已暂停',
  stopping: '正在停止',
  error: '发生异常',
}

export function SpeechTranslationPanel({ controller }: Props) {
  const snapshot = useSpeechTranslation(controller)
  const busy = ['requesting-permission', 'connecting', 'stopping'].includes(
    snapshot.status,
  )

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-5xl flex-col px-5 py-8 sm:px-8 sm:py-12">
      <header className="flex items-end justify-between gap-6 border-b border-slate-800 pb-6">
        <div>
          <p className="mb-2 text-xs font-semibold tracking-[0.24em] text-sky-400 uppercase">
            Tencent Cloud Speech
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-5xl">
            莫莫实时字幕
          </h1>
        </div>
        <div
          aria-live="polite"
          className="min-w-28 text-right text-sm font-medium text-slate-300"
        >
          <span className="mr-2 inline-block size-2 rounded-full bg-sky-400" />
          {statusLabels[snapshot.status]}
        </div>
      </header>

      <p className="mt-5 border-l-2 border-sky-400 pl-4 text-sm leading-6 text-sky-100">
        个人比赛演示项目，使用本地配置完成麦克风实时英译中流程。
      </p>

      <section className="flex min-h-[46svh] flex-1 flex-col justify-center py-10">
        <div aria-live="polite" className="space-y-5">
          {snapshot.sentences.length === 0 ? (
            <p className="max-w-2xl text-2xl leading-relaxed text-slate-500 sm:text-4xl">
              开始后，中文字幕会显示在这里。
            </p>
          ) : (
            snapshot.sentences.map((sentence) => (
              <p
                key={sentence.id}
                className={
                  sentence.isFinal
                    ? 'text-2xl leading-relaxed text-slate-300 sm:text-4xl'
                    : 'text-3xl leading-relaxed font-medium text-white sm:text-5xl'
                }
              >
                {sentence.targetText}
              </p>
            ))
          )}
        </div>

        {snapshot.error && (
          <p
            role="alert"
            className="mt-8 border-t border-red-900 pt-5 text-sm text-red-300"
          >
            {snapshot.error}
          </p>
        )}
      </section>

      <div className="flex min-h-12 flex-wrap gap-3 border-t border-slate-800 pt-6">
        {['idle', 'error'].includes(snapshot.status) && (
          <button
            type="button"
            onClick={() => void controller.start()}
            className="min-w-32 rounded-md bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            {snapshot.status === 'error' ? '重新开始' : '开始翻译'}
          </button>
        )}
        {snapshot.status === 'translating' && (
          <button
            type="button"
            onClick={() => void controller.pause()}
            className="min-w-28 rounded-md border border-slate-600 px-5 py-3 font-semibold text-white transition hover:border-slate-400"
          >
            暂停
          </button>
        )}
        {snapshot.status === 'paused' && (
          <button
            type="button"
            onClick={() => void controller.resume()}
            className="min-w-28 rounded-md bg-sky-400 px-5 py-3 font-semibold text-slate-950 transition hover:bg-sky-300"
          >
            继续
          </button>
        )}
        {['translating', 'paused'].includes(snapshot.status) && (
          <button
            type="button"
            onClick={() => void controller.stop()}
            className="min-w-28 rounded-md border border-slate-700 px-5 py-3 font-semibold text-slate-300 transition hover:border-red-500 hover:text-red-300"
          >
            停止
          </button>
        )}
        {busy && (
          <button
            type="button"
            disabled
            className="min-w-32 cursor-wait rounded-md bg-slate-800 px-5 py-3 font-semibold text-slate-400"
          >
            请稍候
          </button>
        )}
      </div>
    </main>
  )
}
