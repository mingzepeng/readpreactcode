# preact 源码阅读
基于 preact v8.2.6 版本 


preact 是一个非常小巧精简的类 React 前端框架，压缩后大小仅仅 9KB ，提供和 React 一样的 API ，所以可以作为学习 React 和 vdom 的入门阅读代码。


## 函数调用
preact 的代码写得非常精妙，执行过程是一条主线和若干条支线，各类功能穿插在这个主线中，通过各种逻辑判断机制实现整个功能。其主要函数为 diff 函数，所有的执行都在此函数中执行，包括dom的装载、更新和卸载，整个生命周期都是在同一个函数调用流程中完成。函数调用结构见 vsdx 文件


## diff 机制

preact 的 diff 机制和 react 有所不同， preact 的一次 diff 过程只保留最新的 vnode 节点，通过已有的 dom 信息生成上一次的 vnode，将即将更新的 vnode 和已有的 dom 及其生成的 vnode 进行比较，更新 dom 。

### dom 还原 vnode


### 优化点

在更新的过程中，preact 会对一些情景做单独的优化，提高运行效率。

#### 本文节点优化

更新元素且只包含单个 文本 节点的情况下,只改变单个文本节点的值,如  <div>foo</div>  =>  <div>bar</div>

```javascript
	// Optimization: fast-path for elements containing a single TextNode:
    // fc 为当前dom节点的 firstChild
	if (!hydrating && vchildren && vchildren.length===1 && typeof vchildren[0]==='string' && fc!=null && fc.splitText!==undefined && fc.nextSibling==null) {
		if (fc.nodeValue!=vchildren[0]) {
			fc.nodeValue = vchildren[0];
		}
	}
``` 

#### 无key属性的 children 查找优化
```javascript


for (j=min; j<childrenLen; j++) {
    if (children[j]!==undefined && isSameNodeType(c = children[j], vchild, isHydrating)) {
        child = c;
        children[j] = undefined;
        //优化操作,如果找到的是开始和末尾的节点,则从下一次循环排除
        if (j===childrenLen-1) childrenLen--;
        if (j===min) min++;
        break;
    }
}
```

### 数组 diff 算法



## component （Component 实例属性）

base 对应生成的真实 dom
props 组件属性
state 组件状态
_component render 中的 vdom 如果是组件，则指向该组件的实例，在加载后才会有这个值，该组件实例的 _parentComponent 属性指向 _component
_parentComponent 与 _component 相对应

## 常量值
NO_RENDER  
SYNC_RENDER  
FORCE_RENDER  调用组件的 forceUpdate
ASYNC_RENDER  