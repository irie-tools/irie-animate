export type SceneTarget = "hero" | "gallery" | "specs" | "footer";

export type BrandScene = {
  id: string;
  title: string;
  target: SceneTarget;
  sourceVideo?: string;
  frames?: number;
  scrollRangeVh?: number;
  prompt?: string;
};

export type BrandConfig = {
  id: string;
  name: string;
  tagline: string;
  cta: string;
  demoSource?: {
    imagePath: string;
    crop: {
      left: number;
      top: number;
      width: number;
      height: number;
    };
  };
  colors: {
    background: string;
    surface: string;
    text: string;
    muted: string;
    accent: string;
    secondary: string;
  };
  logoText: string;
  motionTone: string;
  scenes: BrandScene[];
  specs: Array<{
    label: string;
    value: string;
  }>;
  workflow: Array<{
    label: string;
    status: "ready" | "manual" | "blocked";
  }>;
};

export type SceneManifest = {
  id: string;
  target: SceneTarget;
  title: string;
  frameCount: number;
  framePattern: string;
  poster: string;
  dimensions: {
    width: number;
    height: number;
  };
  totalBytes: number;
  totalMb: number;
  source: string;
};

export type FramesManifest = {
  brandId: string;
  generatedAt: string;
  scenes: SceneManifest[];
  budgets: {
    heroMaxMb: number;
    totalMaxMb: number;
  };
};
