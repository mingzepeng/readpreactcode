import { h, Component } from '../preact';
// import { Router } from 'preact-router';

import Header from './header';
import Home from './home';
// import Profile from './profile';

const B = (props)=> <div id={props.id || 'app'}>{props.children}</div>
const C = (props)=> <B {...props} />
let i = 0
export default class App extends Component {
	/** Gets fired when the route changes.
	 *	@param {Object} event		"change" event from [preact-router](http://git.io/preact-router)
	 *	@param {string} event.url	The newly routed URL
	 */
	handleRoute = e => {
		this.currentUrl = e.url;
	};

	componentDidMount(){
		i++
		document.addEventListener('click',()=>{
			this.forceUpdate();
		},false);
	}

	render() {
		let children = i == 0 ? [<div key="1" >1</div>,
			<div key="2">2</div>,
			<div key="3">3</div>,
			<div key="4">4</div>] : [<div key="2">2</div>,
				<div key="1">1</div>,
				<div key="3">3</div>,
				<div key="4">4</div>]
		return (
			<C>
			{children}
			</C>
		);
	}
}
