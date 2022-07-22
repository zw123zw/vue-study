/* @flow */

import { emptyNode } from "core/vdom/patch";
import { resolveAsset, handleError } from "core/util/index";
import { mergeVNodeHook } from "core/vdom/helpers/index";

export default {
  create: updateDirectives,
  update: updateDirectives,
  destroy: function unbindDirectives(vnode: VNodeWithData) {
    updateDirectives(vnode, emptyNode);
  },
};

function updateDirectives(oldVnode: VNodeWithData, vnode: VNodeWithData) {
  if (oldVnode.data.directives || vnode.data.directives) {
    _update(oldVnode, vnode);
  }
}

function _update(oldVnode, vnode) {
  const isCreate = oldVnode === emptyNode; // 判断节点是不是新创建的
  const isDestroy = vnode === emptyNode;  // 判断是不是卸载节点
  const oldDirs = normalizeDirectives(
    oldVnode.data.directives,
    oldVnode.context
  );
  const newDirs = normalizeDirectives(vnode.data.directives, vnode.context);

  const dirsWithInsert = [];
  const dirsWithPostpatch = [];

  let key, oldDir, dir;
  for (key in newDirs) {
    oldDir = oldDirs[key];
    dir = newDirs[key];
    if (!oldDir) {
      // new directive, bind
      callHook(dir, "bind", vnode, oldVnode);
      if (dir.def && dir.def.inserted) {
        dirsWithInsert.push(dir);
      }
    } else {
      // existing directive, update
      dir.oldValue = oldDir.value;
      dir.oldArg = oldDir.arg;
      callHook(dir, "update", vnode, oldVnode);
      if (dir.def && dir.def.componentUpdated) {
        dirsWithPostpatch.push(dir);
      }
    }
  }

  if (dirsWithInsert.length) {
    const callInsert = () => {
      for (let i = 0; i < dirsWithInsert.length; i++) {
        callHook(dirsWithInsert[i], "inserted", vnode, oldVnode);
      }
    };
    if (isCreate) {
      // 让指令的inserted方法在被绑定元素插入父节点后再调用
      mergeVNodeHook(vnode, "insert", callInsert);
    } else {
      callInsert();
    }
  }

  if (dirsWithPostpatch.length) {
    mergeVNodeHook(vnode, "postpatch", () => {
      for (let i = 0; i < dirsWithPostpatch.length; i++) {
        callHook(dirsWithPostpatch[i], "componentUpdated", vnode, oldVnode);
      }
    });
  }

  // 旧节点指令在新创建的节点指令中没有那么就将旧节点指令卸载，执行unbind的钩子函数
  if (!isCreate) {
    for (key in oldDirs) {
      if (!newDirs[key]) {
        // no longer present, unbind
        callHook(oldDirs[key], "unbind", oldVnode, oldVnode, isDestroy);
      }
    }
  }
}

const emptyModifiers = Object.create(null);

// 处理指令事件
function normalizeDirectives(
  dirs: ?Array<VNodeDirective>,
  vm: Component
): { [key: string]: VNodeDirective } {
  const res = Object.create(null);
  if (!dirs) {
    // $flow-disable-line
    return res;
  }
  let i, dir;
  for (i = 0; i < dirs.length; i++) {
    dir = dirs[i];
    if (!dir.modifiers) {
      // $flow-disable-line
      dir.modifiers = emptyModifiers;
    }
    res[getRawDirName(dir)] = dir;
    dir.def = resolveAsset(vm.$options, "directives", dir.name, true);
  }
  // $flow-disable-line
  return res;
}

function getRawDirName(dir: VNodeDirective): string {
  return (
    dir.rawName || `${dir.name}.${Object.keys(dir.modifiers || {}).join(".")}`
  );
}

function callHook(dir, hook, vnode, oldVnode, isDestroy) {
  const fn = dir.def && dir.def[hook];
  if (fn) {
    try {
      fn(vnode.elm, dir, vnode, oldVnode, isDestroy);
    } catch (e) {
      handleError(e, vnode.context, `directive ${dir.name} ${hook} hook`);
    }
  }
}
