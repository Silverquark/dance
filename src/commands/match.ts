import * as vscode from "vscode";

import type { Argument, InputOr, RegisterOr } from ".";
import { insert as apiInsert, Context, deindentLines, Direction, edit, findMenu, indentLines, insertByIndex, insertByIndexWithFullLines, insertFlagsAtEdge, joinLines, keypress, moveToExcluded, moveToIncluded, Positions, prompt, replace, replaceByIndex, Selections, Shift, showMenu } from "../api";
import type { Register } from "../state/registers";
import { LengthMismatchError } from "../utils/errors";
import { insert } from "./edit";
import { escapeForRegExp, execRange } from "../utils/regexp";
import { select } from "./selections";
// import { closestSurroundedBy, Context, Direction, keypress, Lines, moveToExcluded, moveWhileBackward, moveWhileForward, Objects, Pair, pair, Positions, prompt, search, SelectionBehavior, Selections, Shift, surroundedBy, wordBoundary } from "../api";

/**
 * Match menu.
 *
 * | Title                   | Keybinding   | Command                            |
 * | ----------------------- | ------------ | ---------------------------------- |
 * | Show match menu         | `m` (normal) | `[".openMenu", { menu: "match" }]` |
 * | Show match menu         | `m` (visual) | `[".openMenu", { menu: "match" }]` |
 */
declare module "./match";

/**
 * Replace stuff surround
 *
 */
export async function surroundreplace(
  _: Context,
  selections: readonly vscode.Selection[],
  inputOr: InputOr<"input", string>,
) {
  const inputFind = await inputOr(() => keypress(_));
  const inputReplace = await inputOr(() => keypress(_));

  const specialCharIndexFind = defaultEnclosingPatternsMatches.findIndex((x => x.some(symbol => symbol === inputFind)));

  let startTextFind = inputFind;
  let endTextFind = inputFind;
  if (specialCharIndexFind !== -1) {
    startTextFind = defaultEnclosingPatternsMatches[specialCharIndexFind][0];
    endTextFind = defaultEnclosingPatternsMatches[specialCharIndexFind][1];
  }

  const specialCharIndexReplace = defaultEnclosingPatternsMatches.findIndex((x => x.some(symbol => symbol === inputReplace)));

  let startTextReplace = inputReplace;
  let endTextReplace = inputReplace;
  if (specialCharIndexReplace !== -1) {
    startTextReplace = defaultEnclosingPatternsMatches[specialCharIndexReplace][0];
    endTextReplace = defaultEnclosingPatternsMatches[specialCharIndexReplace][1];
  }

  const positions = Selections.mapByIndex((_i, selection, document) => {

    const pos = Selections.seekFrom(selection, Direction.Backward);
    const pos2 = Selections.seekFrom(selection, Direction.Backward);

    console.warn(startTextFind);
    const matchForward = moveToExcluded(Direction.Backward, startTextFind, pos2, document);
    const matchBackward = moveToExcluded(Direction.Forward, endTextFind, pos, document);

    // throw new Error("Bla: " + JSON.stringify(selection.active, null, 2) + " " +  JSON.stringify(pos, null, 2)
    // + " " +  JSON.stringify(matchBackward, null, 2) + " " +  JSON.stringify(matchForward, null, 2));
    return [matchBackward, matchForward];
  });

  const flatPositions = [...positions.flat()];

  // Check if any position of found target is the same
  // TODO: Optimize. Theres probably an easier/faster way...
  flatPositions.forEach((outer, i) => {
    flatPositions.forEach((inner, o) => {
      if (i === o) {
        return false;
      }
      if (inner?.line === outer?.line && inner?.character === outer?.character) {
        throw new Error("Cursors overlap for a single surround pair range");
      }
      return;
    });
  });


  return _.run(() => edit((editBuilder, selections, document) => {
    for (const pos of positions) {

      const endRange = new vscode.Range(pos[0]!, new vscode.Position(pos[0]!.line, pos[0]?.character! + 1));
      const startRange = new vscode.Range(pos[1]!, new vscode.Position(pos[1]!.line, pos[1]?.character! - 1));

      editBuilder.replace(endRange, endTextReplace);
      editBuilder.replace(startRange, startTextReplace);

    }
  }));
}

/**
 * Delete stuff surround
 *
 */
export async function surrounddelete(
  _: Context,
  inputOr: InputOr<"input", string>,
) {
  const inputFind = await inputOr(() => keypress(_));

  const specialCharIndexFind = defaultEnclosingPatternsMatches.findIndex((x => x.some(symbol => symbol === inputFind)));

  let startTextFind = inputFind;
  let endTextFind = inputFind;
  if (specialCharIndexFind !== -1) {
    startTextFind = defaultEnclosingPatternsMatches[specialCharIndexFind][0];
    endTextFind = defaultEnclosingPatternsMatches[specialCharIndexFind][1];
  }

  const positions = Selections.mapByIndex((_i, selection, document) => {

    const pos = Selections.seekFrom(selection, Direction.Backward);
    const pos2 = Selections.seekFrom(selection, Direction.Backward);

    console.warn(startTextFind);
    const matchForward = moveToExcluded(Direction.Backward, startTextFind, pos2, document);
    const matchBackward = moveToExcluded(Direction.Forward, endTextFind, pos, document);

    // throw new Error("Bla: " + JSON.stringify(selection.active, null, 2) + " " +  JSON.stringify(pos, null, 2)
    // + " " +  JSON.stringify(matchBackward, null, 2) + " " +  JSON.stringify(matchForward, null, 2));
    return [matchBackward, matchForward];
  });

  const flatPositions = [...positions.flat()];

  // Check if any position of found target is the same
  // TODO: Optimize. Theres probably an easier/faster way...
  flatPositions.forEach((outer, i) => {
    flatPositions.forEach((inner, o) => {
      if (i === o) {
        return false;
      }
      if (inner?.line === outer?.line && inner?.character === outer?.character) {
        throw new Error("Cursors overlap for a single surround pair range");
      }
      return;
    });
  });


  return _.run(() => edit((editBuilder, selections, document) => {
    for (const pos of positions) {

      const endRange = new vscode.Range(pos[0]!, new vscode.Position(pos[0]!.line, pos[0]?.character! + 1));
      const startRange = new vscode.Range(pos[1]!, new vscode.Position(pos[1]!.line, pos[1]?.character! - 1));

      editBuilder.replace(endRange, "");
      editBuilder.replace(startRange, "");

    }
  }));
}

/**
 * Add stuff surround
 *
 */
export async function surround(
  _: Context,
  selections: readonly vscode.Selection[],
  register: RegisterOr<"dquote", Register.Flags.CanRead>,
  inputOr: InputOr<"input", string>,
) {
  const input = await inputOr(() => keypress(_));

  // const languageConfig = vscode.workspace.getConfiguration("editor.language", _.document),
  //       bracketsConfig = languageConfig.get<readonly [string, string][]>("brackets");
  // TODO: investigate why this always seems to return null. Static list is good enough for now

  const specialCharIndex = defaultEnclosingPatternsMatches.findIndex((x => x.some(symbol => symbol === input)));

  let startText;
  let endText;
  if (specialCharIndex !== -1) {
    startText = defaultEnclosingPatternsMatches[specialCharIndex][0];
    endText = defaultEnclosingPatternsMatches[specialCharIndex][1];
  } else {
    startText = input;
    endText = input;
  }

  await insert(_, selections, register, true, false, 0, false, undefined, endText, "end");
  await insert(_, selections, register, true, false, 0, false, undefined, startText, "start");

}

const defaultEnclosingPatternsMatches = [
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  ["<", ">"],
];