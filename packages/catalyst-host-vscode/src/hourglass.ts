/**
 * A bug under way turns its hourglass in the Instances tree until it is closed (REQ-000121-UVqkd7cL).
 *
 * VS Code does not animate a tree label's text, so the hourglass turns over: the label flips between ⏳ and
 * ⌛ on a timer. This keeps which elements turn, which frame they are on, and the timer; it knows nothing of
 * VS Code, so the tree provider asks it for the frame and redraws the elements it names.
 */
export class Hourglass<T> {
  private readonly turning = new Set<T>();
  private turnedOver = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private visible = true;

  /**
   * @param redraw called with the elements to redraw on each turn (never empty).
   * @param reduceMotion whether motion is turned off (VS Code's `workbench.reduceMotion: on`): then nothing turns.
   * @param everyMs how often the hourglass turns over.
   */
  constructor(
    private readonly redraw: (elements: T[]) => void,
    private readonly reduceMotion: () => boolean = () => false,
    private readonly everyMs = 1000,
  ) {}

  /** Whether an element shown with ⏳ should be drawn turned over (⌛) now; records it as turning. */
  show(element: T, turns: boolean): boolean {
    if (!turns || this.reduceMotion()) {
      this.turning.delete(element);
      return false;
    }
    this.turning.add(element);
    this.start();
    return this.turnedOver;
  }

  /** The whole tree was rebuilt: its old elements are gone, the turning ones are found again as they are shown. */
  reset(): void {
    this.turning.clear();
  }

  /** The view was shown or hidden: a hidden view turns nothing. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    if (visible && this.turning.size > 0) this.start();
    else if (!visible) this.stop();
  }

  /** Whether the timer runs. */
  get running(): boolean {
    return this.timer !== undefined;
  }

  /** Stops the timer for good. */
  dispose(): void {
    this.stop();
    this.turning.clear();
  }

  private start(): void {
    if (this.timer !== undefined || !this.visible || this.reduceMotion()) return;
    this.timer = setInterval(() => {
      this.tick();
    }, this.everyMs);
  }

  private stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    if (this.turning.size === 0 || !this.visible || this.reduceMotion()) {
      this.stop();
      if (this.turnedOver) {
        this.turnedOver = false; // never left turned over: the elements show ⏳ again
        if (this.turning.size > 0) this.redraw([...this.turning]);
      }
      return;
    }
    this.turnedOver = !this.turnedOver;
    this.redraw([...this.turning]);
  }
}
