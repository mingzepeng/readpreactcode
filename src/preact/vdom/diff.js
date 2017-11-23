import { ATTR_KEY } from '../constants';
import { isSameNodeType, isNamedNode } from './index';
import { buildComponentFromVNode } from './component';
import { createNode, setAccessor } from '../dom/index';
import { unmountComponent } from './component';
import options from '../options';
import { removeNode } from '../dom/index';

/** Queue of components that have been mounted and are awaiting componentDidMount */
export const mounts = [];

/** Diff recursion count, used to track the end of the diff cycle. */
export let diffLevel = 0;

/** Global flag indicating if the diff is currently within an SVG */
let isSvgMode = false;

/** Global flag indicating if the diff is performing hydration */
let hydrating = false;

/** Invoke queued componentDidMount lifecycle methods */
export function flushMounts() {
	let c;
	while ((c=mounts.pop())) {
		if (options.afterMount) options.afterMount(c);

		if (c.componentDidMount) c.componentDidMount();
	}
}


/** Apply differences in a given vnode (and it's deep children) to a real DOM Node.
 *	@param {Element} [dom=null]		A DOM node to mutate into the shape of the `vnode`
 *	@param {VNode} vnode			A VNode (with descendants forming a tree) representing the desired DOM structure
 *	@returns {Element} dom			The created/mutated element
 *	@private
 */
export function diff(dom, vnode, context, mountAll, parent, componentRoot) {
	// diffLevel having been 0 here indicates initial entry into the diff (not a subdiff)
	console.log(diffLevel)
	if (!diffLevel++) {
		// when first starting the diff, check if we're diffing an SVG or within an SVG
		isSvgMode = parent!=null && parent.ownerSVGElement!==undefined;
		
		// hydration is indicated by the existing element to be diffed not having a prop cache
		hydrating = dom!=null && !(ATTR_KEY in dom);
	}

	// 返回最终的 dom
	let ret = idiff(dom, vnode, context, mountAll, componentRoot);

	// append the element if its a new parent
	// 作用一：首次 mount 的时候，把虚拟dom生成的 element 挂载到 root element 中
	// 
	if (parent && ret.parentNode!==parent) parent.appendChild(ret);

	// diffLevel being reduced to 0 means we're exiting the diff
	if (!--diffLevel) {
		hydrating = false;
		// invoke queued componentDidMount lifecycle methods
		// 执行生命周期函数 componentDidMount
		if (!componentRoot) flushMounts();
	}

	return ret;
}


/** Internals of `diff()`, separated to allow bypassing diffLevel / mount flushing. */
function idiff(dom, vnode, context, mountAll, componentRoot) {
	let out = dom,
		prevSvgMode = isSvgMode;

	// empty values (null, undefined, booleans) render as empty Text nodes
	if (vnode==null || typeof vnode==='boolean') vnode = '';


	// Fast case: Strings & Numbers create/update Text nodes.
	if (typeof vnode==='string' || typeof vnode==='number') {

		// update if it's already a Text node:
		if (dom && dom.splitText!==undefined && dom.parentNode && (!dom._component || componentRoot)) {
			/* istanbul ignore if */ /* Browser quirk that can't be covered: https://github.com/developit/preact/commit/fd4f21f5c45dfd75151bd27b4c217d8003aa5eb9 */
			if (dom.nodeValue!=vnode) {
				dom.nodeValue = vnode;
			}
		}
		else {
			// it wasn't a Text node: replace it with one and recycle the old Element
			out = document.createTextNode(vnode);
			if (dom) {
				//out is new, dom is replaced
				if (dom.parentNode) dom.parentNode.replaceChild(out, dom);
				// document.body.replaceChild()
				recollectNodeTree(dom, true);
			}
		}

		out[ATTR_KEY] = true;

		return out;
	}


	// If the VNode represents a Component, perform a component diff:
	let vnodeName = vnode.nodeName;
	if (typeof vnodeName==='function') {
		return buildComponentFromVNode(dom, vnode, context, mountAll);
	}


	// Tracks entering and exiting SVG namespace when descending through the tree.
	isSvgMode = vnodeName==='svg' ? true : vnodeName==='foreignObject' ? false : isSvgMode;


	// If there's no existing element or it's the wrong type, create a new one:
	//  这边是如果元素类型改变了,比如原来是  div ,现在换成了 span,那么把原来 div 的children 加入到 span 中,并把 span 替换 div 所处的位置
	vnodeName = String(vnodeName);
	if (!dom || !isNamedNode(dom, vnodeName)) {
		out = createNode(vnodeName, isSvgMode);

		if (dom) {
			// move children into the replacement node
			while (dom.firstChild) out.appendChild(dom.firstChild);

			// if the previous Element was mounted into the DOM, replace it inline
			if (dom.parentNode) dom.parentNode.replaceChild(out, dom);

			// recycle the old element (skips non-Element node types)
			recollectNodeTree(dom, true);
		}
	}
	// 接下来处理 元素的 children 

	let fc = out.firstChild,
		props = out[ATTR_KEY],
		vchildren = vnode.children;

	if (props==null) {
		props = out[ATTR_KEY] = {};
		for (let a=out.attributes, i=a.length; i--; ) props[a[i].name] = a[i].value;
	}

	// Optimization: fast-path for elements containing a single TextNode:
	//单独优化：元素且只包含单个 文本 节点的情况下,只改变单个文本节点的值,如  <div>foo</div>  =>  <div>bar</div>
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
	// otherwise, if there are existing or new children, diff them:
	//  否则：如果存在其他子元素，那么开始 diff 
	else if (vchildren && vchildren.length || fc!=null) {
		innerDiffNode(out, vchildren, context, mountAll, hydrating || props.dangerouslySetInnerHTML!=null);
	}


	// Apply attributes/props from VNode to the DOM Element:
	// 对 diff 的元素进行属性的增删改
	diffAttributes(out, vnode.attributes, props);


	// restore previous SVG mode: (in case we're exiting an SVG namespace)
	isSvgMode = prevSvgMode;

	return out;
}


/** Apply child and attribute changes between a VNode and a DOM Node to the DOM.
 * 	首次生成 , dom 元素为父元素，在 idiff 中生成，且为空，因为子元素还没有生成，这个方法就是生成子元素的
 * 
 *	@param {Element} dom			Element whose children should be compared & mutated
 *	@param {Array} vchildren		Array of VNodes to compare to `dom.childNodes`
 *	@param {Object} context			Implicitly descendant context object (from most recent `getChildContext()`)
 *	@param {Boolean} mountAll
 *	@param {Boolean} isHydrating	If `true`, consumes externally created elements similar to hydration
 */
function innerDiffNode(dom, vchildren, context, mountAll, isHydrating) {
	let originalChildren = dom.childNodes,
		children = [],
		keyed = {},
		keyedLen = 0,
		min = 0,
		len = originalChildren.length,
		childrenLen = 0,
		vlen = vchildren ? vchildren.length : 0,
		j, c, f, vchild, child;

	// Build up a map of keyed children and an Array of unkeyed children:
	if (len!==0) {
		let i 
		for (i=0; i<len; i++) {
			console.log(i)
			let child = originalChildren[i],
				props = child[ATTR_KEY],
				key = vlen && props ? (child._component ? child._component.__key : props.key) : null;
			if (key!=null) {
				keyedLen++;
				keyed[key] = child;
			}
			else if (props || (child.splitText!==undefined ? (isHydrating ? child.nodeValue.trim() : true) : isHydrating)) {
				children[childrenLen++] = child;
			}
		}
	}

	if (vlen!==0) {
		// 循环 虚拟 dom 的子元素(列表)
		for (var i=0; i<vlen; i++) {
			vchild = vchildren[i];
			child = null;

			// attempt to find a node based on key matching
			// 首先找到一个 key ，同时都存在即将更新和已存在的children中
			let key = vchild.key;
			if (key!=null) {
				if (keyedLen && keyed[key]!==undefined) {
					child = keyed[key];
					keyed[key] = undefined;
					keyedLen--;
				}
			}
			// attempt to pluck a node of the same type from the existing children
			// 如果不存在 key,则从已有的 dom 中找到 同类型的 节点
			else if (!child && min<childrenLen) {
				for (j=min; j<childrenLen; j++) {
					if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
						child = c;
						children[j] = undefined;
						//优化操作,如果找到的是开始和末尾的节点,则从下一次循环排除
						//如果children 未改变, 这种情况的优化效果相当好
						if (j===childrenLen-1) childrenLen--;
						if (j===min) min++;
						break;
					}
				}
			}

			// morph the matched/found/created DOM child to match vchild (deep)
			// diff 当前的 child 和 vchild ,递归操作
			// 首次生成:此处会生成父元素下的子元素
			// 在新增一个节点,此时新生成一个,随后执行下面代码的 @3
			child = idiff(child, vchild, context, mountAll);

			//如果是首次生成,则 originalChildren 为空集合, f 为 undefined
			f = originalChildren[i];  
			
			// 如果不进入这个 if, 说明 child 和 f 是同一个节点，此时已经对 f 的属性进行了更新
			// 进入这个if 说明 diff 后的新节点和已有的节点非同一个节点
			if (child && child!==dom && child!==f) {
				if (f==null) {
					// @1
					//新增节点
					//首次生成的话,会把 子元素添加到父元素里
					dom.appendChild(child);
				}
				else if (child===f.nextSibling) {
					//@2
					//删除节点
					//相邻两个顺序颠倒，如 a,b => b,a 移除a，在下一轮就把a添加到b后面元素的前面，即添加到 b 的后面，实现位置互换
					removeNode(f);
				}
				else {
					//@3 
					// update 阶段,新增节点
					// 变换顺序之1:把末尾的放到首位
					dom.insertBefore(child, f);
				}
			}
		}
	}


	// remove unused keyed children:
	if (keyedLen) {
		for (let i in keyed) if (keyed[i]!==undefined) recollectNodeTree(keyed[i], false);
	}

	// remove orphaned unkeyed children:
	while (min<=childrenLen) {
		if ((child = children[childrenLen--])!==undefined) recollectNodeTree(child, false);
	}
}



/** Recursively recycle (or just unmount) a node and its descendants.
 *	@param {Node} node						DOM node to start unmount/removal from
 *	@param {Boolean} [unmountOnly=false]	If `true`, only triggers unmount lifecycle, skips removal
 */
export function recollectNodeTree(node, unmountOnly) {
	let component = node._component;
	if (component) {
		// 如果 node 有对应的 _component,则会进行收集

		// if node is owned by a Component, unmount that component (ends up recursing back here)
		unmountComponent(component);
	}
	else {
		// If the node's VNode had a ref function, invoke it with null here.
		// (this is part of the React spec, and smart for unsetting references)
		if (node[ATTR_KEY]!=null && node[ATTR_KEY].ref) node[ATTR_KEY].ref(null);

		if (unmountOnly===false || node[ATTR_KEY]==null) {
			// 直接删除节点
			removeNode(node);
		}
		// 对node的children 调用 recollectNodeTree
		removeChildren(node);
	}
}


/** Recollect/unmount all children.
 *	- we use .lastChild here because it causes less reflow than .firstChild
 *	- it's also cheaper than accessing the .childNodes Live NodeList
 */
export function removeChildren(node) {
	node = node.lastChild;
	while (node) {
		let next = node.previousSibling;
		recollectNodeTree(node, true);
		node = next;
	}
}


/** Apply differences in attributes from a VNode to the given DOM Element.
 *	@param {Element} dom		Element with attributes to diff `attrs` against
 *	@param {Object} attrs		The desired end-state key-value attribute pairs
 *	@param {Object} old			Current/previous attributes (from previous VNode or element's prop cache)
 */
function diffAttributes(dom, attrs, old) {
	let name;

	// remove attributes no longer present on the vnode by setting them to undefined
	for (name in old) {
		if (!(attrs && attrs[name]!=null) && old[name]!=null) {
			setAccessor(dom, name, old[name], old[name] = undefined, isSvgMode);
		}
	}

	// add new & update changed attributes
	for (name in attrs) {
		if (name!=='children' && name!=='innerHTML' && (!(name in old) || attrs[name]!==(name==='value' || name==='checked' ? dom[name] : old[name]))) {
			setAccessor(dom, name, old[name], old[name] = attrs[name], isSvgMode);
		}
	}
}
