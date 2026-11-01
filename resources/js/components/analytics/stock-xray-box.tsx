import { useEffect, useRef, useState } from 'react';
import type { DonutSlice } from '@/components/charts';
import { cn } from '@/lib/utils';

type Three = typeof import('three');
type Addons = {
    RoomEnvironment: typeof import('three/examples/jsm/environments/RoomEnvironment.js').RoomEnvironment;
    RoundedBoxGeometry: typeof import('three/examples/jsm/geometries/RoundedBoxGeometry.js').RoundedBoxGeometry;
};

/** Crates shown inside, shared out by each status's share of the supplies. */
const CRATES = 12;
/** A stack is two crates wide and four high. */
const STACK_COLUMNS = 2;
const STACK_ROWS = 4;

/**
 * Stock overview as a cardboard inventory box: a circle around the pointer
 * sees through it to the stock inside, one stack of crates per status in
 * the legend's colours (out-of-stock crates are empty outlines). Hovering a
 * legend row lifts its stack (`active`). Three.js loads only here, after
 * the page shows; without WebGL `onUnavailable` is called so the page can
 * show the donut instead. Decorative: the legend carries the numbers.
 */
export function StockXrayBox({
    slices,
    active,
    onUnavailable,
    className,
}: {
    /** Well stocked, low stock, out of stock: in that order. */
    slices: DonutSlice[];
    active: number | null;
    onUnavailable: () => void;
    className?: string;
}) {
    const root = useRef<HTMLDivElement>(null);
    const ring = useRef<HTMLDivElement>(null);
    const activeRef = useRef(active);
    activeRef.current = active;
    const unavailable = useRef(onUnavailable);
    unavailable.current = onUnavailable;
    const slicesRef = useRef(slices);
    slicesRef.current = slices;
    const [ready, setReady] = useState(false);
    const [touch, setTouch] = useState(false);
    // Rebuilt only when the numbers change.
    const key = slices
        .map((slice) => `${slice.value}:${slice.color}`)
        .join('|');

    useEffect(() => {
        const host = root.current;
        const ringEl = ring.current;

        if (!host || !ringEl) {
            return;
        }

        setTouch(!window.matchMedia('(hover: hover)').matches);

        if (!hasWebGl()) {
            unavailable.current();

            return;
        }

        let dispose: (() => void) | null = null;
        let cancelled = false;

        Promise.all([
            import('three'),
            import('three/examples/jsm/environments/RoomEnvironment.js'),
            import('three/examples/jsm/geometries/RoundedBoxGeometry.js'),
        ])
            .then(([THREE, room, rounded]) => {
                if (cancelled) {
                    return;
                }

                dispose = mountScene(
                    host,
                    ringEl,
                    THREE,
                    {
                        RoomEnvironment: room.RoomEnvironment,
                        RoundedBoxGeometry: rounded.RoundedBoxGeometry,
                    },
                    slicesRef.current,
                    () => activeRef.current,
                    () => setReady(true),
                );
            })
            .catch(() => !cancelled && unavailable.current());

        return () => {
            cancelled = true;
            dispose?.();
            setReady(false);
        };
    }, [key]);

    return (
        <div
            ref={root}
            aria-hidden
            className={cn(
                'relative h-64 w-full touch-pan-y overflow-hidden rounded-xl select-none',
                className,
            )}
        >
            <div className="absolute inset-0 bg-[radial-gradient(60%_55%_at_50%_45%,color-mix(in_oklch,var(--color-amber-500)_14%,transparent),transparent_70%)]" />
            <div
                ref={ring}
                className={cn(
                    'pointer-events-none absolute top-0 left-0 rounded-full border-[1.5px] border-white/95 shadow-[0_0_0_1px_rgb(120_80_40/0.55),0_10px_26px_rgb(60_35_10/0.25)] transition-opacity duration-300',
                    ready ? 'opacity-100' : 'opacity-0',
                )}
            />
            <span
                className={cn(
                    'pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border bg-background/80 px-2.5 py-1 font-mono text-[9px] font-semibold tracking-[0.08em] whitespace-nowrap text-muted-foreground uppercase backdrop-blur transition-opacity duration-300',
                    ready ? 'opacity-100' : 'opacity-0',
                )}
            >
                {touch ? 'Drag to look inside' : 'Move to look inside'}
            </span>
        </div>
    );
}

function hasWebGl(): boolean {
    try {
        const canvas = document.createElement('canvas');

        return Boolean(
            canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
        );
    } catch {
        return false;
    }
}

/** Any CSS colour (a var, oklch…) as rgb() that Three.js understands. */
function cssColor(value: string, from: HTMLElement): string {
    const variable = /^var\((--[^),]+)\)$/.exec(value.trim());
    const color = variable
        ? getComputedStyle(from).getPropertyValue(variable[1]).trim()
        : value;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) {
        return '#888888';
    }

    context.fillStyle = '#888888';
    context.fillStyle = color;
    context.fillRect(0, 0, 1, 1);
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;

    return `rgb(${r}, ${g}, ${b})`;
}

/** How many crates each status gets: by share, at least one if any. */
function crateCounts(values: number[]): number[] {
    const total = values.reduce((sum, value) => sum + value, 0);

    return values.map((value) =>
        value <= 0 || total === 0
            ? 0
            : Math.min(
                  STACK_COLUMNS * STACK_ROWS,
                  Math.max(1, Math.round((value / total) * CRATES)),
              ),
    );
}

/** The box's printed label: what's inside, a barcode, "this side up". */
function labelCanvas(): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 300;
    const g = canvas.getContext('2d');

    if (!g) {
        return canvas;
    }

    g.fillStyle = '#f4ecdc';
    g.fillRect(0, 0, 512, 300);
    g.strokeStyle = '#3b2a1a';
    g.lineWidth = 6;
    g.strokeRect(10, 10, 492, 280);
    g.fillStyle = '#3b2a1a';
    g.font = '700 58px ui-sans-serif, system-ui, sans-serif';
    g.fillText('SUPPLIES', 34, 88);
    g.font = '600 26px ui-monospace, monospace';
    g.fillText('CHED RO XII · SINOP', 36, 130);

    // Barcode.
    let x = 36;

    for (let i = 0; i < 46; i++) {
        const w = [2, 3, 5][(i * 7) % 3];
        g.fillRect(x, 160, w, 84);
        x += w + [2, 4, 3][(i * 5) % 3];
    }

    // "This side up" arrows.
    g.lineWidth = 8;
    g.lineCap = 'round';
    [400, 450].forEach((ax) => {
        g.beginPath();
        g.moveTo(ax, 250);
        g.lineTo(ax, 175);
        g.moveTo(ax - 20, 198);
        g.lineTo(ax, 172);
        g.lineTo(ax + 20, 198);
        g.stroke();
    });
    g.fillRect(380, 258, 90, 8);

    return canvas;
}

function mountScene(
    root: HTMLElement,
    ringEl: HTMLElement,
    THREE: Three,
    { RoomEnvironment, RoundedBoxGeometry }: Addons,
    slices: DonutSlice[],
    getActive: () => number | null,
    onReady: () => void,
): () => void {
    const own: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
        own.push(item);

        return item;
    };
    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)',
    ).matches;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.domElement.style.position = 'absolute';
    renderer.domElement.style.inset = '0';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    root.insertBefore(renderer.domElement, ringEl);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = environment.texture;
    const sun = new THREE.DirectionalLight(0xfff1dc, 1.4);
    sun.position.set(2.5, 4, 3);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.25, 6.4);
    camera.lookAt(0, -0.3, 0);

    // The circle, in drawing-buffer pixels, shared by every patched material:
    // the outside is cut away inside it, the inside shows only within it.
    const uMouse = { value: new THREE.Vector2(-9999, -9999) };
    const uR = { value: 100 };
    const patch = <M extends InstanceType<Three['Material']>>(
        material: M,
        inside: boolean,
    ): M => {
        material.onBeforeCompile = (shader) => {
            shader.uniforms.uMouse = uMouse;
            shader.uniforms.uR = uR;
            shader.fragmentShader =
                'uniform vec2 uMouse;\nuniform float uR;\n' +
                shader.fragmentShader.replace(
                    '#include <clipping_planes_fragment>',
                    `#include <clipping_planes_fragment>\n  if (distance(gl_FragCoord.xy, uMouse) ${inside ? '> uR' : '< uR'}) discard;`,
                );
        };
        material.customProgramCacheKey = () =>
            inside ? 'xray-in' : 'xray-out';

        return track(material);
    };

    const box = new THREE.Group();
    scene.add(box);

    // The carton: brown board, packing tape, a printed label.
    const [W, H, D] = [2.4, 1.75, 1.8];
    const shellGeo = track(new RoundedBoxGeometry(W, H, D, 4, 0.06));
    box.add(
        new THREE.Mesh(
            shellGeo,
            patch(
                new THREE.MeshStandardMaterial({
                    color: 0xb9854f,
                    roughness: 0.92,
                    metalness: 0,
                }),
                false,
            ),
        ),
    );
    const tapeMat = patch(
        new THREE.MeshStandardMaterial({ color: 0xdcbf8e, roughness: 0.45 }),
        false,
    );
    const topTape = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.36, 0.012, D + 0.012)),
        tapeMat,
    );
    topTape.position.y = H / 2 + 0.004;
    const frontTape = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.36, 0.42, 0.012)),
        tapeMat,
    );
    frontTape.position.set(0, H / 2 - 0.21, D / 2 + 0.004);
    const labelTexture = track(new THREE.CanvasTexture(labelCanvas()));
    labelTexture.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
        track(new THREE.PlaneGeometry(0.92, 0.54)),
        patch(
            new THREE.MeshStandardMaterial({
                map: labelTexture,
                roughness: 0.7,
            }),
            false,
        ),
    );
    label.position.set(W / 2 - 0.62, -H / 2 + 0.42, D / 2 + 0.008);
    box.add(topTape, frontTape, label);

    // Inside: dark board walls, and the stock.
    box.add(
        new THREE.Mesh(
            shellGeo,
            patch(
                new THREE.MeshStandardMaterial({
                    color: 0x3d2714,
                    roughness: 1,
                    side: THREE.BackSide,
                }),
                true,
            ),
        ),
    );

    const crateGeo = track(new THREE.BoxGeometry(0.33, 0.33, 0.33));
    const edgeGeo = track(new THREE.EdgesGeometry(crateGeo));
    const counts = crateCounts(slices.map((slice) => slice.value));
    const step = 0.37;
    const stacks = slices.map((slice, index) => {
        const color = new THREE.Color(cssColor(slice.color ?? '#888', root));
        const empty = index === slices.length - 1; // out of stock
        const group = new THREE.Group();
        group.position.x = (index - (slices.length - 1) / 2) * 0.78;
        const solid = empty
            ? patch(
                  new THREE.MeshBasicMaterial({
                      color,
                      transparent: true,
                      opacity: 0.12,
                      depthWrite: false,
                  }),
                  true,
              )
            : patch(
                  new THREE.MeshStandardMaterial({
                      color,
                      emissive: color,
                      emissiveIntensity: 0.3,
                      roughness: 0.5,
                  }),
                  true,
              );
        const edges = patch(
            new THREE.LineBasicMaterial({
                color: empty ? color : color.clone().multiplyScalar(0.6),
            }),
            true,
        );

        for (let n = 0; n < counts[index]; n++) {
            const column = n % STACK_COLUMNS;
            const row = Math.floor(n / STACK_COLUMNS);
            const crate = new THREE.Group();
            crate.position.set(
                (column - (STACK_COLUMNS - 1) / 2) * step,
                -H / 2 + 0.22 + row * step,
                0.15,
            );
            crate.add(new THREE.Mesh(crateGeo, solid));
            crate.add(new THREE.LineSegments(edgeGeo, edges));
            group.add(crate);
        }

        box.add(group);

        return { group, solid, empty, lift: 0 };
    });

    // Soft shadow under the box.
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = shadowCanvas.height = 128;
    const sg = shadowCanvas.getContext('2d');

    if (sg) {
        const gradient = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
        gradient.addColorStop(0, 'rgba(60,35,10,.32)');
        gradient.addColorStop(1, 'rgba(60,35,10,0)');
        sg.fillStyle = gradient;
        sg.fillRect(0, 0, 128, 128);
    }

    const shadow = new THREE.Mesh(
        track(new THREE.PlaneGeometry(4, 1.2)),
        track(
            new THREE.MeshBasicMaterial({
                map: track(new THREE.CanvasTexture(shadowCanvas)),
                transparent: true,
                depthWrite: false,
            }),
        ),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.45;
    scene.add(shadow);

    // Size, and the circle with it.
    let width = 1;
    let height = 1;
    const resize = () => {
        width = root.clientWidth || 1;
        height = root.clientHeight || 1;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        // Narrow cards step back so the whole box fits.
        camera.position.z =
            camera.aspect < 1.2 ? 6.4 * (1.2 / camera.aspect) : 6.4;
        camera.updateProjectionMatrix();
        const radius = Math.min(width, height) * 0.3;
        ringEl.style.width = ringEl.style.height = `${radius * 2}px`;
        ringEl.style.margin = `${-radius}px 0 0 ${-radius}px`;
        uR.value = radius * renderer.getPixelRatio();
    };
    resize();
    const resizer = new ResizeObserver(resize);
    resizer.observe(root);

    // Where the circle should be (0–1); it rests in the middle.
    let target = { x: 0.5, y: 0.5 };
    const at = { x: 0.5, y: 0.5 };
    const onMove = (event: PointerEvent) => {
        const rect = root.getBoundingClientRect();
        target = {
            x: (event.clientX - rect.left) / rect.width,
            y: (event.clientY - rect.top) / rect.height,
        };
    };
    const onLeave = () => {
        target = { x: 0.5, y: 0.5 };
    };
    root.addEventListener('pointermove', onMove);
    root.addEventListener('pointerleave', onLeave);

    // Draw only while the card is on screen and the tab is visible.
    let onScreen = true;
    const watcher = new IntersectionObserver(([entry]) => {
        onScreen = entry.isIntersecting;
    });
    watcher.observe(root);

    const start = performance.now();
    let last = start;
    let frame = 0;
    const loop = (now: number) => {
        frame = requestAnimationFrame(loop);

        if (!onScreen || document.hidden) {
            last = now;

            return;
        }

        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        const t = reduceMotion ? 0 : (now - start) / 1000;
        const ease = 1 - Math.exp(-dt * 12);
        at.x += (target.x - at.x) * ease;
        at.y += (target.y - at.y) * ease;
        ringEl.style.transform = `translate(${at.x * width}px, ${at.y * height}px)`;
        const ratio = renderer.getPixelRatio();
        uMouse.value.set(at.x * width * ratio, (1 - at.y) * height * ratio);

        // A slow sway that keeps the front (and its label) facing us.
        box.rotation.y = -0.45 + Math.sin(t * 0.35) * 0.3;
        box.rotation.x = 0.32 + Math.sin(t * 0.5) * 0.04;

        const active = getActive();
        stacks.forEach((stack, index) => {
            const goal = active === index ? 1 : 0;
            stack.lift += (goal - stack.lift) * (reduceMotion ? 1 : ease);
            stack.group.position.y =
                stack.lift * 0.14 + Math.sin(t * 1.6 + index) * 0.015;

            if (stack.solid instanceof THREE.MeshStandardMaterial) {
                stack.solid.emissiveIntensity = 0.3 + stack.lift * 0.6;
            } else if (stack.solid instanceof THREE.MeshBasicMaterial) {
                stack.solid.opacity = 0.12 + stack.lift * 0.2;
            }
        });

        renderer.render(scene, camera);
    };

    // Compile the shaders first so showing the box doesn't stall the page.
    let stopped = false;
    void renderer.compileAsync(scene, camera).then(() => {
        if (!stopped) {
            frame = requestAnimationFrame(loop);
            onReady();
        }
    });

    return () => {
        stopped = true;
        cancelAnimationFrame(frame);
        resizer.disconnect();
        watcher.disconnect();
        root.removeEventListener('pointermove', onMove);
        root.removeEventListener('pointerleave', onLeave);
        own.forEach((item) => item.dispose());
        environment.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.forceContextLoss();
        renderer.domElement.remove();
    };
}
