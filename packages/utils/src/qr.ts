import QRCode from "qrcode";

export interface QRGenerateOptions {
  width?: number;
  margin?: number;
  darkColor?: string;
  lightColor?: string;
  errorCorrectionLevel?: "L" | "M" | "Q" | "H";
}

/**
 * Generate a QR code as a data URL (base64 PNG)
 */
export async function generateQRDataUrl(
  data: string,
  options: QRGenerateOptions = {}
): Promise<string> {
  const {
    width = 300,
    margin = 2,
    darkColor = "#000000",
    lightColor = "#ffffff",
    errorCorrectionLevel = "M",
  } = options;

  return QRCode.toDataURL(data, {
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel,
  });
}

/**
 * Generate a QR code as SVG string
 */
export async function generateQRSvg(
  data: string,
  options: QRGenerateOptions = {}
): Promise<string> {
  const {
    width = 300,
    margin = 2,
    darkColor = "#000000",
    lightColor = "#ffffff",
    errorCorrectionLevel = "M",
  } = options;

  return QRCode.toString(data, {
    type: "svg",
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel,
  });
}

/**
 * Generate a QR code as Buffer (PNG)
 */
export async function generateQRBuffer(
  data: string,
  options: QRGenerateOptions = {}
): Promise<Buffer> {
  const {
    width = 300,
    margin = 2,
    darkColor = "#000000",
    lightColor = "#ffffff",
    errorCorrectionLevel = "M",
  } = options;

  return QRCode.toBuffer(data, {
    width,
    margin,
    color: {
      dark: darkColor,
      light: lightColor,
    },
    errorCorrectionLevel,
  });
}

/**
 * Build the content for a registration QR code
 */
export function buildQRContent(baseUrl: string, qrCode: string): string {
  return `${baseUrl}?code=${encodeURIComponent(qrCode)}`;
}
