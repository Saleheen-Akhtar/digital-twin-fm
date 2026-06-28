import { render, screen, fireEvent } from "@testing-library/react";
import { DigitalTwinViewer3D } from "./viewer-3d";
import { useViewerStore } from "./viewer-store";

// R3F Canvas uses WebGL which doesn't exist in jsdom. Mock everything.
jest.mock("@react-three/fiber", () => ({
  Canvas: ({ children, ...props }: any) => (
    <div data-testid="r3f-canvas" {...props}>
      {children}
    </div>
  ),
  useThree: () => ({
    camera: { position: { lerp: () => {} } },
    controls: { target: { lerp: () => {} } },
  }),
  useFrame: () => {},
  ThreeEvent: {},
}));

// Mock every drei component used by viewer-building.tsx and viewer-3d.tsx.
// Keep this list in sync with imports in viewer-3d.tsx / viewer-building.tsx.
jest.mock("@react-three/drei", () => ({
  OrbitControls: () => <div data-testid="orbit-controls" />,
  CameraControls: () => <div data-testid="camera-controls" />,
  Html: ({ children }: any) => <div data-testid="html-label">{children}</div>,
  Grid: () => <div data-testid="grid" />,
  Edges: ({ children, visible }: any) => (
    <div data-testid="edges" data-visible={visible}>
      {children}
    </div>
  ),
  // viewer-3d.tsx imports these for the studio lighting rig.
  ContactShadows: () => <div data-testid="contact-shadows" />,
  Environment: ({ children }: any) => (
    <div data-testid="environment">{children}</div>
  ),
}));

// Stub react-dom createPortal so Html components render inline
jest.mock("react-dom", () => ({
  ...jest.requireActual("react-dom"),
  createPortal: (node: any) => node,
}));

beforeEach(() => {
  useViewerStore.setState({
    selectedFloor: "ALL",
    selectedType: "ALL",
    selectedAsset: null,
  });
  // Reset any toggled overlays between tests. The component reads from
  // useState initialValue, so we unmount/remount via render()'s cleanup.
  // No global state to clear — each render gets a fresh component.
});

describe("DigitalTwinViewer3D", () => {
  it("renders the viewer container without crashing", () => {
    const { getByTestId } = render(<DigitalTwinViewer3D />);
    expect(getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });

  it("defaults to operator mode", () => {
    const { getByTestId } = render(<DigitalTwinViewer3D />);
    expect(getByTestId("digital-twin-viewer-3d").getAttribute("data-viewer-mode")).toBe("operator");
  });

  it("showcase mode hides all overlays and the icon rail", () => {
    const { getByTestId, queryByTestId } = render(
      <DigitalTwinViewer3D mode="showcase" />,
    );
    expect(getByTestId("digital-twin-viewer-3d").getAttribute("data-viewer-mode")).toBe("showcase");
    // No overlays, no icon rail in showcase mode
    expect(queryByTestId("viewer-icon-rail")).toBeNull();
    expect(document.querySelector("[data-overlay]")).toBeNull();
  });

  it("operator mode renders the icon rail", () => {
    render(<DigitalTwinViewer3D mode="operator" />);
    expect(screen.getByTestId("viewer-icon-rail")).toBeInTheDocument();
  });

  it("operator mode shows KPI strip by default, floor selector closed until clicked", () => {
    const { container } = render(<DigitalTwinViewer3D mode="operator" />);
    expect(container.querySelector('[data-overlay="kpis"]')).not.toBeNull();
    expect(container.querySelector('[data-overlay="floors"]')).toBeNull();
    expect(container.querySelector('[data-overlay="events"]')).toBeNull();
    expect(container.querySelector('[data-overlay="layers"]')).toBeNull();
    expect(container.querySelector('[data-overlay="ai"]')).toBeNull();
    expect(container.querySelector('[data-overlay="health"]')).toBeNull();
  });

  it("icon rail button toggles the events overlay on click", () => {
    const { container } = render(<DigitalTwinViewer3D mode="operator" />);
    expect(container.querySelector('[data-overlay="events"]')).toBeNull();
    const eventsBtn = container.querySelector(
      '[data-rail-button="events"]',
    ) as HTMLElement;
    expect(eventsBtn).toBeTruthy();
    fireEvent.click(eventsBtn);
    expect(container.querySelector('[data-overlay="events"]')).not.toBeNull();
  });

  it("defaultOpenOverlays prop opens the listed overlays on mount", () => {
    const { container } = render(
      <DigitalTwinViewer3D mode="operator" defaultOpenOverlays={["events", "ai"]} />,
    );
    expect(container.querySelector('[data-overlay="events"]')).not.toBeNull();
    expect(container.querySelector('[data-overlay="ai"]')).not.toBeNull();
    expect(container.querySelector('[data-overlay="layers"]')).toBeNull();
  });

  it("shows floor selector with All Floors + L1 + L2 buttons", () => {
    render(<DigitalTwinViewer3D />);
    // Open floor selector via icon rail first
    fireEvent.click(screen.getByTitle("Floor selector"));
    expect(screen.getByText("All Floors")).toBeInTheDocument();
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
  });

  it("shows the Walk toggle in the icon rail", () => {
    render(<DigitalTwinViewer3D mode="operator" />);
    expect(screen.getByText("Walk")).toBeInTheDocument();
  });

  it("hides asset markers when showMarkers=false", () => {
    render(<DigitalTwinViewer3D showMarkers={false} />);
    expect(screen.getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });

  it("highlights the active floor button when one is selected", () => {
    useViewerStore.setState({ selectedFloor: 0 });
    render(<DigitalTwinViewer3D />);
    // Open floor selector via icon rail (no longer open by default)
    fireEvent.click(screen.getByTitle("Floor selector"));
    const l1 = screen.getByText("L1");
    expect(l1.className).toContain("bg-blue-600");
  });

  it("renders with autoRotate without crashing", () => {
    render(<DigitalTwinViewer3D autoRotate={true} />);
    expect(screen.getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });
});
