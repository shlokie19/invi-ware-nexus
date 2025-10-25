import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, CheckCircle, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Verification() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: "authentic" | "fake"; confidence: number } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const { toast } = useToast();

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
    if (!selectedFile) return;

    setIsVerifying(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Mock result
    const mockResult = {
      status: Math.random() > 0.5 ? "authentic" : "fake",
      confidence: Math.floor(Math.random() * 30) + 70,
    } as { status: "authentic" | "fake"; confidence: number };

    setResult(mockResult);
    setIsVerifying(false);

    toast({
      title: "Verification Complete",
      description: `Product detected as ${mockResult.status} with ${mockResult.confidence}% confidence`,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Product Verification</h1>
        <p className="text-muted-foreground">CNN-based fake product detection system</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
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
                  className="w-full bg-primary hover:bg-primary/90"
                >
                  {isVerifying ? "Verifying..." : "Verify Product"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>Verification Result</CardTitle>
          </CardHeader>
          <CardContent>
            {!result ? (
              <div className="text-center py-12 text-muted-foreground">
                Upload an image and click verify to see results
              </div>
            ) : (
              <div className="space-y-6">
                <div
                  className={`p-6 rounded-lg border-2 ${
                    result.status === "authentic"
                      ? "border-success bg-success/10"
                      : "border-destructive bg-destructive/10"
                  }`}
                >
                  <div className="flex items-center justify-center mb-4">
                    {result.status === "authentic" ? (
                      <CheckCircle className="h-16 w-16 text-success" />
                    ) : (
                      <XCircle className="h-16 w-16 text-destructive" />
                    )}
                  </div>
                  <h3 className="text-2xl font-bold text-center mb-2">
                    {result.status === "authentic" ? "Product Authentic" : "Fake Product Detected"}
                  </h3>
                  <p className="text-center text-muted-foreground">
                    Confidence: {result.confidence}%
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Analysis Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Model Used:</span>
                      <span className="font-medium">CNN-ResNet50</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Processing Time:</span>
                      <span className="font-medium">1.8s</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Image Quality:</span>
                      <span className="font-medium">High</span>
                    </div>
                  </div>
                </div>

                {result.status === "fake" && (
                  <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                    <p className="text-sm">
                      <strong>Action Required:</strong> This product has been flagged as potentially counterfeit.
                      Please isolate the item and notify the quality assurance team.
                    </p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
