import { h, Component } from '../../preact';
// import { Link } from 'preact-router';
import style from './style.less';

export default class Header extends Component {



	render() {
		return (
			<header class={style.header}>
				<h1>Preact App</h1>
				<nav>
					<a href="#">Home</a>
					<a href="#">Me</a>
					<a href="#">John</a>
				</nav>
			</header>
		);
	}
}
