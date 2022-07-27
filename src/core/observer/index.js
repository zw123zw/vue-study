/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import {
	arrayMethods
} from './array'
import {
	def,
	warn,
	hasOwn,
	hasProto,
	isObject,
	isPlainObject,
	isPrimitive,
	isUndef,
	isValidArrayIndex,
	isServerRendering
} from '../util/index'
import { log } from 'console'

// Object.getOwnPropertyNames()方法返回一个由指定对象的所有自身属性的属性名（包括不可枚举属性但不包括符号值作为名称的属性）组成的数组。
const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving(value: boolean) {
	shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */

// 其整个流程大致如下：

// Data通过observer转换成了getter/setter的形式来追踪变化。
// 当外界通过Watcher读取数据时，会触发getter从而将Watcher添加到依赖中。
// 当数据发生了变化时，会触发setter，从而向Dep中的依赖（即Watcher）发送通知。
// Watcher接收到通知后，会向外界发送通知，变化通知到外界后可能会触发视图更新，也有可能触发用户的某个回调函数等。

// 在最开始的地方，把普通数据对象转换为“可观测”的对象(数据响应)，同时在getter中收集依赖，在setter中通知依赖更新，依赖就是一个watcher实例数组
// 每个使用响应数据的地方都是一个watcher实例，在创建Watcher实例的过程中会调用响应数据上面的getter，这样自动的把自己添加到这个响应数据对应的依赖管理器中

export class Observer {
	value: any; //value是一个数组或者对象
	dep: Dep; //当前数据的订阅器
	vmCount: number; // number of vms that have this object as root $data

	constructor(value: any) {
		this.value = value
		// 实例化一个依赖管理器，用来收集数组依赖,在defineReactive中使用
		this.dep = new Dep()
		this.vmCount = 0
		// 给value新增一个__ob__属性，值为该value的Observer实例
		// 相当于为value打上标记，表示它已经被转化成响应式了，避免重复操作
		def(value, '__ob__', this) //设置数据属性
		if (Array.isArray(value)) {
			// 其实Array型数据的依赖收集方式和Object数据的依赖收集方式相同，都是在getter中收集。那么问题就来了，不是说Array无法使用Object.defineProperty方法吗？无法使用怎么还在getter中收集依赖呢？
			// 想想看，arr这个数据始终都存在于一个object数据对象中，而且我们也说了，谁用到了数据谁就是依赖，那么要用到arr这个数据，是不是得先从object数据对象中获取一下arr数据，而从object数据对象中获取arr数据自然就会触发arr的getter，所以我们就可以在getter中收集依赖。
			// 总结一句话就是：Array型数据还是在getter中收集依赖。

			// Array型数据还是在getter中收集依赖，换句话说就是我们已经知道了Array型数据何时被读取了,Object的变化时通过setter来追踪的，只有某个数据发生了变化，就一定会触发这个数据上的setter。但是Array型数据没有setter，要想让Array型数据发生变化，那必然是操作了Array，而JS中提供的操作数组的方法就那么几种，我们可以把这些方法都重写一遍，在不改变原有功能的前提下，我们为其新增一些其他功能

			// 也就是重写数组的原型方法
			if (hasProto) {
				protoAugment(value, arrayMethods)
			} else {
				copyAugment(value, arrayMethods, arrayKeys)
			}
			this.observeArray(value)
		} else {
			this.walk(value)
		}
	}

	/**
	 * Walk through all properties and convert them into
	 * getter/setters. This method should only be called when
	 * value type is Object.
	 */
	walk(obj: Object) {
		const keys = Object.keys(obj)
		for (let i = 0; i < keys.length; i++) {
			defineReactive(obj, keys[i])
		}
	}

	/**
	 * Observe a list of Array items.
	 */
	observeArray(items: Array < any > ) {
		for (let i = 0, l = items.length; i < l; i++) {
			observe(items[i])
		}
	}
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 */
function protoAugment(target, src: Object) {
	/* eslint-disable no-proto */
	target.__proto__ = src
	/* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 */
/* istanbul ignore next */
function copyAugment(target: Object, src: Object, keys: Array < string > ) {
	for (let i = 0, l = keys.length; i < l; i++) {
		const key = keys[i]
		def(target, key, src[key])
	}
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 */
export function observe(value: any, asRootData: ? boolean): Observer | void {
	// 当值不是Object时直接返回
	if (!isObject(value) || value instanceof VNode) {
		return
	}
	let ob: Observer | void
	if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
		ob = value.__ob__
	} else if (
		shouldObserve &&
		!isServerRendering() &&
		(Array.isArray(value) || isPlainObject(value)) &&
		Object.isExtensible(value) &&
		!value._isVue
	) {
		ob = new Observer(value)
	}
	if (asRootData && ob) {
		ob.vmCount++
	}
	return ob
}

/**
 * Define a reactive property on an Object.
 */
// 将数据转化为响应式
export function defineReactive(
	obj: Object,
	key: string,
	val: any,
	customSetter ? : ? Function,
	shallow ? : boolean
) {
	const dep = new Dep()

	const property = Object.getOwnPropertyDescriptor(obj, key)
	// configurable为false时，当前对象不可以被改变
	if (property && property.configurable === false) {
		return
	}

	// cater for pre-defined getter/setters
	const getter = property && property.get
	const setter = property && property.set
	// !getter || setter 表示没有getter方法（也就是数据属性）或者有getter方法并且有setter方法时为true
	// arguments.length === 2表示根据obj[key]来取值，将val保存起来
	if ((!getter || setter) && arguments.length === 2) {
		val = obj[key]
	}

	//当数据时多级对象时，递归创建watcher实例
	let childOb = !shallow && observe(val)

	// Object.defineProperty() 方法会直接在一个对象上定义一个新属性，或修改一个对象的现有属性，并返回此对象
	Object.defineProperty(obj, key, {
		enumerable: true,
		configurable: true,
		get: function reactiveGetter() {
			const value = getter ? getter.call(obj) : val
			// 每当一个watcher实例使用getter函数读取数据时，就将当前watcher添加到依赖数组中，同一级只收集同一级的依赖
			if (Dep.target) {
				// 父级收集父级依赖
				dep.depend()
				if (childOb) {
					// 子级收集子级依赖，dep是Observer在初始化时设置了this.dep = new Dep()
					childOb.dep.depend()
					if (Array.isArray(value)) {
						// 多级时递归添加依赖
						dependArray(value)
					}
				}
			}
			return value
		},
		set: function reactiveSetter(newVal) {
			const value = getter ? getter.call(obj) : val
			/* eslint-disable no-self-compare */
			if (newVal === value || (newVal !== newVal && value !== value)) {
				return
			}
			/* eslint-enable no-self-compare */
			if (process.env.NODE_ENV !== 'production' && customSetter) {
				customSetter()
			}
			// #7981: for accessor properties without setter
			if (getter && !setter) return
			if (setter) {
				setter.call(obj, newVal)
			} else {
				val = newVal
			}
			childOb = !shallow && observe(newVal)
			dep.notify()
		}
	})
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set(target: Array < any > | Object, key: any, val: any): any {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.length = Math.max(target.length, key)
		target.splice(key, 1, val)
		return val
	}
	//如果存在属性key，那么就不是新增，只是修改属性值，不需要进行后续操作	
	if (key in target && !(key in Object.prototype)) {
		target[key] = val
		return val
	}
	const ob = (target: any).__ob__
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid adding reactive properties to a Vue instance or its root $data ' +
			'at runtime - declare it upfront in the data option.'
		)
		return val
	}
	if (!ob) {
		target[key] = val
		return val
	}
	// 设置数据为响应式并且发生通知
	defineReactive(ob.value, key, val)
	ob.dep.notify()
	return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del(target: Array < any > | Object, key: any) {
	if (process.env.NODE_ENV !== 'production' &&
		(isUndef(target) || isPrimitive(target))
	) {
		warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
	}
	if (Array.isArray(target) && isValidArrayIndex(key)) {
		target.splice(key, 1)
		return
	}
	const ob = (target: any).__ob__
	// 如果target上有_isVue属性或者ob.vmCount数量大于1则直接返回，因为删除不能是vue.js实例或者根数据，比如this.$data
	if (target._isVue || (ob && ob.vmCount)) {
		process.env.NODE_ENV !== 'production' && warn(
			'Avoid deleting properties on a Vue instance or its root $data ' +
			'- just set it to null.'
		)
		return
	}
	// 如果key在target中不存在，则直接返回
	if (!hasOwn(target, key)) {
		return
	}
	delete target[key]
	// 不是响应式则不需要发生通知
	if (!ob) {
		return
	}
	ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray(value: Array < any > ) {
	for (let e, i = 0, l = value.length; i < l; i++) {
		e = value[i]
		e && e.__ob__ && e.__ob__.dep.depend()
		if (Array.isArray(e)) {
			dependArray(e)
		}
	}
}
