import * as vscode from "vscode";

/**
 * Window menu.
 *
 * #### Predefined keybindings
 *
 * | Title                   | Identifier                     | Keybinding                     | Command                                  |
 * | ----------------------- | ------------------------------ | ------------------------------ | ---------------------------------------- |
 * | Show window menu        | `windowMenu`                   | `c-w` (normal), `c-w` (visual) | `[".openMenu", { menu: "window", ... }]` |
 */
declare module "./window";