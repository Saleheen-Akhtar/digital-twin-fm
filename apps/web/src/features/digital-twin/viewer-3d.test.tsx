import { render, screen } from "@testing-library/react";
import { DigitalTwinViewer3D } from "./viewer-3d";
import { useViewerStore } from "./viewer-store";
import { SEED_ASSETS, STATUS_DISPLAY } from "./viewer-data";

// OrbitControls is an ES module that Jest/ts-jest can't parse directly.
// Stub it with a no-op class so the import succeeds without booting
// the full Three.js controls module in jsdom. The viewer code does:
//   controls.target.set(...)
//   controls.autoRotate = ...
//   controls.dampingFactor = ...
// so the stub exposes the right properties.
jest.mock("three/examples/jsm/controls/OrbitControls.js", () => ({
  OrbitControls: class {
    target = { set: () => {}, x: 0, y: 0, z: 0 };
    autoRotate = false;
    autoRotateSpeed = 0;
    enableDamping = false;
    dampingFactor = 0;
    minPolarAngle = 0;
    maxPolarAngle = Math.PI;
    minDistance = 0;
    maxDistance = Infinity;
    constructor() {}
    update() {}
    dispose() {}
  },
}));

// Replace THREE.WebGLRenderer with a no-op stub. The real constructor
// calls dozens of WebGL methods (getExtension, getShaderPrecisionFormat,
// ...) that don't exist in jsdom. The stub lets the useEffect mount
// without throwing, so the React tree (floor selector, status panel,
// inspect panel, building info panel) is fully testable.
jest.mock("three", () => {
  const actual = jest.requireActual("three");
  const stubCanvas = () => {
    const c = document.createElement("canvas");
    return c;
  };
  class WebGLRenderer {
    domElement: HTMLCanvasElement = stubCanvas();
    shadowMap = { enabled: false, type: 0 };
    constructor(_opts?: unknown) {}
    setPixelRatio(_v: number) {}
    setSize(_w: number, _h: number) {}
    setClearColor(_c: unknown, _a?: number) {}
    render() {}
    dispose() {}
  }
  return { ...actual, WebGLRenderer };
});

/**
 * Viewer tests — verify the data flow + overlay panels.
 *
 * The Three.js scene (WebGLRenderer + RAF + ResizeObserver) mounts in a
 * useEffect; jsdom + the WebGL stub in jest.setup.ts lets the constructor
 * run without crashing, but no actual rendering happens. These tests
 * focus on what matters: the React tree, the derived data (status
 * panel counts, visibleAssets), and the regression for the
 * "selecting one marker hides all others" bug.
 */

beforeEach(() => {
  // Reset the Zustand store between tests
  useViewerStore.setState({
    selectedFloor: "ALL",
    selectedType: "ALL",
    selectedAsset: null,
  });
});

describe("DigitalTwinViewer3D", () => {
  it("renders the canvas + floor selector without crashing", () => {
    const { getByTestId } = render(<DigitalTwinViewer3D />);
    expect(getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
    expect(getByTestId("floor-selector")).toBeInTheDocument();
  });

  it("exposes ALL + GF + F1 + F2 + F3 floor buttons", () => {
    render(<DigitalTwinViewer3D />);
    const sel = screen.getByTestId("floor-selector");
    for (const label of ["ALL", "GF", "F1", "F2", "F3"]) {
      expect(sel.textContent).toContain(label);
    }
  });

  it("shows the type legend only when showMarkers=true", () => {
    const { rerender, queryByTestId } = render(<DigitalTwinViewer3D />);
    expect(queryByTestId("type-legend")).toBeInTheDocument();
    rerender(<DigitalTwinViewer3D showMarkers={false} />);
    expect(queryByTestId("type-legend")).not.toBeInTheDocument();
  });

  it("shows the building info panel only when showMarkers=false", () => {
    const { rerender, queryByTestId } = render(<DigitalTwinViewer3D />);
    expect(queryByTestId("building-info-panel")).not.toBeInTheDocument();
    rerender(<DigitalTwinViewer3D showMarkers={false} />);
    expect(queryByTestId("building-info-panel")).toBeInTheDocument();
  });

  it("shows the status panel with totals from SEED_ASSETS when no filter", () => {
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("status-panel");
    // SEED_ASSETS has 20 entries total; status is deterministic from
    // STATUS_PATTERN (70% OK, 20% warn, 10% fault).
    const expectedOp = SEED_ASSETS.filter(
      (a) => a.status === "operational",
    ).length;
    const expectedWarn = SEED_ASSETS.filter(
      (a) => a.status === "warning",
    ).length;
    const expectedFault = SEED_ASSETS.filter(
      (a) => a.status === "fault",
    ).length;
    expect(panel.textContent).toContain(String(expectedOp));
    expect(panel.textContent).toContain(String(expectedWarn));
    expect(panel.textContent).toContain(String(expectedFault));
    expect(panel.textContent).toContain(String(SEED_ASSETS.length));
  });

  it("filters status totals when a floor is selected", () => {
    useViewerStore.setState({ selectedFloor: 0 });
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("status-panel");
    // Floor 0 has 6 assets (3 Chiller + 2 Boiler + 1 Pump)
    expect(panel.textContent).toContain(String(6));
  });

  it("filters status totals when a type is selected", () => {
    useViewerStore.setState({ selectedType: "Chiller" });
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("status-panel");
    // 4 Chillers total
    expect(panel.textContent).toContain(String(4));
  });

  it("does NOT filter the status panel when an asset is selected (Bug 1 regression)", () => {
    // The original bug: visibleAssets was filtered to just the
    // selectedAsset, so the status panel would show 1/1/1/1 instead
    // of the full floor+type breakdown. Fix: visibleAssets only
    // depends on floor + type filters, not on selectedAsset.
    const target = SEED_ASSETS[0];
    useViewerStore.setState({
      selectedFloor: "ALL",
      selectedType: "ALL",
      selectedAsset: target,
    });
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("status-panel");
    // Status panel should still show ALL 20 assets, not just the selected one
    expect(panel.textContent).toContain(String(SEED_ASSETS.length));
    expect(panel.textContent).not.toContain("1\nTotal");
  });

  it("renders the inspect panel collapsed when nothing is selected", () => {
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("inspect-panel");
    expect(panel.style.opacity).toBe("0");
    // maxHeight is "0" (collapsed) — either "0" or "0px" both indicate collapsed
    expect(panel.style.maxHeight).toMatch(/^0(px)?$/);
  });

  it("renders the inspect panel with the selected asset when one is set", () => {
    const target = SEED_ASSETS[0];
    useViewerStore.setState({ selectedAsset: target });
    render(<DigitalTwinViewer3D />);
    const panel = screen.getByTestId("inspect-panel");
    expect(panel.style.opacity).toBe("1");
    expect(panel.textContent).toContain(target.name);
    expect(panel.textContent).toContain(target.type);
    expect(panel.textContent).toContain(STATUS_DISPLAY[target.status]);
  });

  it("lists every SEED_ASSETS entry in the building info panel when its floor is active", () => {
    useViewerStore.setState({ selectedFloor: 0 });
    render(<DigitalTwinViewer3D showMarkers={false} />);
    const panel = screen.getByTestId("building-info-panel");
    const floor0Assets = SEED_ASSETS.filter((a) => a.floor === 0);
    for (const a of floor0Assets) {
      expect(panel.textContent).toContain(a.name);
    }
  });

  it("hides the status + inspect + type panels on the homepage preview", () => {
    const { queryByTestId } = render(
      <DigitalTwinViewer3D showMarkers={false} />,
    );
    expect(queryByTestId("status-panel")).not.toBeInTheDocument();
    expect(queryByTestId("inspect-panel")).not.toBeInTheDocument();
    expect(queryByTestId("type-legend")).not.toBeInTheDocument();
    // Floor selector + building info panel are still visible
    expect(queryByTestId("floor-selector")).toBeInTheDocument();
    expect(queryByTestId("building-info-panel")).toBeInTheDocument();
  });
});
