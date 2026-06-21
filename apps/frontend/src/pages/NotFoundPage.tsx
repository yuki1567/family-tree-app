import { Link } from 'react-router'

export function NotFoundPage() {
	return (
		<section>
			<h1>404 — ページが見つかりません</h1>
			<p>
				<Link to="/">ホームに戻る</Link>
			</p>
		</section>
	)
}
