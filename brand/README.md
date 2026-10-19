# Brand assets

Placeholders until the brand's own mark exists (brand roadmap item 6; the `brand` roadmap and
`docs/design/25-brand-spike.md`). They are our own drawings, so nothing the UI ships is of unknown licence (item 4).

| File                       | What                                                                | Used as                                                                                                                                                                |
| -------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `placeholder-mark.svg`     | three linked nodes (rule, work, commit), monochrome, `currentColor` | the VS Code activity bar, the views and the `.catalyst` file icon (`packages/catalyst-host-vscode/resources/catalyst.svg`)                                             |
| `placeholder-app-icon.svg` | the mark in white on neutral slate (`#2d333b`), 1024 px             | the desktop app icon (`packages/catalyst-host-electron/build/icon.png`, 1024 px) and the Marketplace icon (`packages/catalyst-host-vscode/resources/icon.png`, 256 px) |

The chain inspector's section and type icons are VS Code's own Codicons (`packages/catalyst-host-vscode/src/codicons.ts`);
the extension ships no icon files of its own.

To regenerate the PNGs on macOS:

```
qlmanage -t -s 1024 -o /tmp brand/placeholder-app-icon.svg
cp /tmp/placeholder-app-icon.svg.png packages/catalyst-host-electron/build/icon.png
sips -z 256 256 /tmp/placeholder-app-icon.svg.png --out packages/catalyst-host-vscode/resources/icon.png
```
