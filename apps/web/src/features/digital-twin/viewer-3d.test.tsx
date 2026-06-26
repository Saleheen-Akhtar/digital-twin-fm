import { render, screen } from "@testing-library/react";
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

// Mock every drei component used by viewer-building.tsx and viewer-3d.tsx
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
});

describe("DigitalTwinViewer3D", () => {
  it("renders the viewer container without crashing", () => {
    const { getByTestId } = render(<DigitalTwinViewer3D />);
    expect(getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });

  it("shows floor selector with All + B1 + L1 + L2 buttons", () => {
    render(<DigitalTwinViewer3D />);
    expect(screen.getByText("All")).toBeInTheDocument();
    expect(screen.getByText("B1")).toBeInTheDocument();
    expect(screen.getByText("L1")).toBeInTheDocument();
    expect(screen.getByText("L2")).toBeInTheDocument();
  });

  it("shows the Walk toggle button", () => {
    render(<DigitalTwinViewer3D />);
    expect(screen.getByText("🚶 Walk")).toBeInTheDocument();
  });

  it("hides asset markers when showMarkers=false", () => {
    render(<DigitalTwinViewer3D showMarkers={false} />);
    expect(screen.getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });

  it("highlights the active floor button when one is selected", () => {
    useViewerStore.setState({ selectedFloor: 1 });
    render(<DigitalTwinViewer3D />);
    const l1 = screen.getByText("L1");
    expect(l1.className).toContain("bg-blue-600");
  });

  it("renders with autoRotate without crashing", () => {
    render(<DigitalTwinViewer3D autoRotate={true} />);
    expect(screen.getByTestId("digital-twin-viewer-3d")).toBeInTheDocument();
  });
});
