import { NavLink, Outlet } from 'react-router'
import './AppLayout.css'

export function AppLayout() {
	return (
		<div className="app-layout">
			<header className="app-header">
				<span className="app-logo">FamilyTree</span>
				<nav className="app-nav">
					<NavLink to="/" end>
						ホーム
					</NavLink>
				</nav>
			</header>
			<main className="app-main">
				<Outlet />
			</main>
		</div>
	)
}
