import { useEffect, useState } from 'react'
import { api } from '../api/apiClient'

type ApiStatus = 'idle' | 'loading' | 'ok' | 'error'

export function HomePage() {
	const [status, setStatus] = useState<ApiStatus>('idle')

	useEffect(() => {
		setStatus('loading')
		api.health
			.$get()
			.then((r) => {
				if (r.ok) setStatus('ok')
				else setStatus('error')
			})
			.catch(() => setStatus('error'))
	}, [])

	return (
		<section>
			<h1>FamilyTree へようこそ</h1>
			{status === 'loading' && <p>API を確認中…</p>}
			{status === 'error' && (
				<p>
					API
					に接続できませんでした（バックエンドが起動しているか確認してください）
				</p>
			)}
			{status === 'ok' && <p>API ステータス: ok</p>}
		</section>
	)
}
