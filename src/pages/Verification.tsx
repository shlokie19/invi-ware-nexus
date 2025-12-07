import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Upload, CheckCircle, XCircle, AlertTriangle, Loader2, Settings, Eye, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationResult {
  status: "authentic" | "fake" | "suspicious";
  confidence: number;
  analysis: {
    findings: string[];
    redFlags: string[];
    authenticityMarkers: string[];
    recommendation: string;
  };
  processingTime: number;
}

export default function Verification() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [apiKey, setApiKey] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  const { toast } = useToast();

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  const saveApiKey = () => {
    if (apiKey.trim().startsWith('sk-ant-')) {
      localStorage.setItem('claude_api_key', apiKey.trim());
      setShowSettings(false);
      toast({
        title: "API Key Saved",
        description: "Your Claude API key has been saved securely.",
      });
    } else {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid Claude API key starting with 'sk-ant-'",
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setResult(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleVerify = async () => {
    if (!selectedFile || !preview) {
      toast({
        title: "No Image Selected",
        description: "Please upload an image first.",
        variant: "destructive",
      });
      return;
    }

    if (!apiKey) {
      toast({
        title: "API Key Required",
        description: "Please configure your Claude API key in settings.",
        variant: "destructive",
      });
      setShowSettings(true);
      return;
    }

    setIsVerifying(true);
    const startTime = Date.now();

    try {
      // Convert base64 to proper format for API
      const base64Data = preview.split(',')[1];
      const mediaType = preview.split(';')[0].split(':')[1];

      // Use a CORS proxy for development
      const proxyUrl = 'https://corsproxy.io/?';
      const apiUrl = 'https://api.anthropic.com/v1/messages';

      const response = await fetch(proxyUrl + encodeURIComponent(apiUrl), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 1500,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: mediaType,
                    data: base64Data,
                  },
                },
                {
                  type: 'text',
                  text: `You are an expert product authentication system analyzing this product image for authenticity.

Analyze the image focusing on:
1. **Packaging Quality**: Print clarity, color consistency, alignment
2. **Logo & Branding**: Sharpness, correct fonts, proper placement
3. **Labels & Text**: Spelling, formatting, barcode quality
4. **Materials**: Overall quality, construction, finishes
5. **Security Features**: Holograms, seals, serial numbers (if visible)

Provide your analysis in this EXACT JSON format (no other text):
{
  "isAuthentic": true/false,
  "confidence": 0-100,
  "findings": ["finding 1", "finding 2", "finding 3"],
  "redFlags": ["red flag 1", "red flag 2"],
  "authenticityMarkers": ["marker 1", "marker 2"],
  "recommendation": "brief recommendation"
}

Rules:
- confidence above 75 = authentic
- confidence 40-75 = suspicious  
- confidence below 40 = fake
- Be specific about what you see
- List 3-5 findings minimum`,
                },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error('API request failed. Check console for details.');
      }

      const data = await response.json();
      const analysisText = data.content[0].text;
      
      // Parse JSON from response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse AI response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);

      // Determine status based on confidence
      let status: "authentic" | "fake" | "suspicious";
      if (analysis.confidence >= 75) {
        status = "authentic";
      } else if (analysis.confidence >= 40) {
        status = "suspicious";
      } else {
        status = "fake";
      }

      setResult({
        status,
        confidence: analysis.confidence,
        analysis: {
          findings: analysis.findings || [],
          redFlags: analysis.redFlags || [],
          authenticityMarkers: analysis.authenticityMarkers || [],
          recommendation: analysis.recommendation || "Further verification recommended.",
        },
        processingTime: parseFloat(processingTime),
      });

      toast({
        title: "Analysis Complete",
        description: `Product verified in ${processingTime}s`,
      });

    } catch (error) {
      console.error('Verification error:', error);
      toast({
        title: "Verification Failed",
        description: error instanceof Error ? error.message : "Network error. Please check your connection and API key.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Verification</h1>
          <p className="text-muted-foreground">AI-powered fake product detection system</p>
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* API Key Settings */}
      {showSettings && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg">Claude API Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">API Key</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="sk-ant-..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={saveApiKey}>Save</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Get your API key from{" "}
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  console.anthropic.com
                </a>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Important Note about CORS */}
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900">
              <strong>Note:</strong> This demo uses a CORS proxy (corsproxy.io) to enable browser-based API calls. 
              In production, API calls should be made from a backend server for security.
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Upload Product Image</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary/50 transition-colors">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload"
              />
              <label htmlFor="file-upload" className="cursor-pointer">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                  <br />
                  PNG, JPG or JPEG (max 10MB)
                </p>
              </label>
            </div>

            {preview && (
              <div className="space-y-4">
                <img src={preview} alt="Preview" className="w-full rounded-lg border" />
                <Button
                  onClick={handleVerify}
                  disabled={isVerifying}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing with AI...
                    </>
                  ) : (
                    <>
                      <Eye className="mr-2 h-4 w-4" />
                      Verify Product
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results Section */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-12 text-muted-foreground">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Upload an image and click verify to see results</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Badge */}
                <div
                  className={`p-6 rounded-lg border-2 ${
                    result.status === "authentic"
                      ? "border-green-500 bg-green-50"
                      : result.status === "suspicious"
                      ? "border-yellow-500 bg-yellow-50"
                      : "border-red-500 bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-center mb-4">
                    {result.status === "authentic" ? (
                      <CheckCircle className="h-16 w-16 text-green-600" />
                    ) : result.status === "suspicious" ? (
                      <AlertTriangle className="h-16 w-16 text-yellow-600" />
                    ) : (
                      <XCircle className="h-16 w-16 text-red-600" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-2">
                    {result.status === "authentic"
                      ? "Product Appears Authentic"
                      : result.status === "suspicious"
                      ? "Suspicious - Needs Review"
                      : "Likely Counterfeit"}
                  </h3>
                  <p className="text-center text-muted-foreground">
                    Confidence: {result.confidence}%
                  </p>
                </div>

                {/* Analysis Details */}
                <div className="space-y-3">
                  <h4 className="font-medium">Analysis Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model Used:</span>
                      <span className="font-medium">Claude AI Vision</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Time:</span>
                      <span className="font-medium">{result.processingTime}s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Analysis Type:</span>
                      <span className="font-medium">Computer Vision</span>
                    </div>
                  </div>
                </div>

                {/* Findings */}
                {result.analysis.findings.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm">Key Findings:</h4>
                    <ul className="space-y-1 text-sm">
                      {result.analysis.findings.map((finding, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-blue-600 mt-1">•</span>
                          <span className="text-muted-foreground">{finding}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Red Flags */}
                {result.analysis.redFlags.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-red-600">⚠️ Red Flags:</h4>
                    <ul className="space-y-1 text-sm">
                      {result.analysis.redFlags.map((flag, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-red-600 mt-1">•</span>
                          <span className="text-red-700">{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Authenticity Markers */}
                {result.analysis.authenticityMarkers.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-green-600">✓ Authenticity Markers:</h4>
                    <ul className="space-y-1 text-sm">
                      {result.analysis.authenticityMarkers.map((marker, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-green-600 mt-1">•</span>
                          <span className="text-green-700">{marker}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Recommendation */}
                <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-sm">
                    <strong>Recommendation:</strong> {result.analysis.recommendation}
                  </p>
                </div>

                {/* Warning for non-authentic */}
                {result.status !== "authentic" && (
                  <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <p className="text-sm text-red-900">
                      <strong>Action Required:</strong> This product has been flagged for potential authenticity issues.
                      Please conduct additional verification or consult with manufacturer.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Footer */}
      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-6">
          <div className="text-sm text-blue-900 space-y-2">
            <p className="font-semibold">About AI Verification:</p>
            <p>
              This system uses Claude AI's computer vision capabilities to analyze product images for authenticity markers. 
              It checks packaging quality, logo clarity, printing precision, and common counterfeit indicators.
            </p>
            <p className="text-xs text-blue-700 italic">
              Note: This is a preliminary screening tool. For high-value items or official authentication, 
              please consult manufacturer verification services.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
