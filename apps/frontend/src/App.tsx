import { APP_NAME, type Person } from 'shared'

// shared の型を消費して型共有の配線を確認する
const sample: Person = { id: 'demo', name: '名無しの権兵衛' }

export function App() {
  return (
    <main>
      <h1>{APP_NAME}</h1>
      <p>モノレポ雛形が動作しています。</p>
      <p>shared からの型共有サンプル: {sample.name}</p>
    </main>
  )
}
