'use client';

import { useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, X, CheckCircle2, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function UploadPhotosPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const bookingId = params?.bookingId as string;
  
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    
    // Validate files
    const validFiles = selectedFiles.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: `${file.name} is not an image file.`,
        });
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: `${file.name} is larger than 10MB.`,
        });
        return false;
      }
      return true;
    });

    setFiles(prev => [...prev, ...validFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (files.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No files selected',
        description: 'Please select at least one photo to upload.',
      });
      return;
    }

    setIsUploading(true);

    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`/api/bookings/${bookingId}/upload-makeup-photos`, {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to upload photo');
        }

        const data = await response.json();
        setUploadedImages(prev => [...prev, data.url]);
      }

      setIsComplete(true);
      toast({
        title: 'Photos uploaded successfully!',
        description: 'Thank you for sharing your photos with us. We\'ll make sure to check them out!',
      });

      // Clear files after successful upload
      setFiles([]);
      
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload photos. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold">Share Your Photos 📸</CardTitle>
          <p className="text-muted-foreground mt-2">
            Upload your favorite photos from your appointment with Looks by Anum
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {isComplete ? (
            <div className="text-center space-y-4 py-8">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <h3 className="text-2xl font-bold">Thank You!</h3>
              <p className="text-muted-foreground">
                Your photos have been uploaded successfully. We'd love to see them and with your permission, 
                we may share them on our social media!
              </p>
              {uploadedImages.length > 0 && (
                <div className="mt-6">
                  <p className="text-sm font-medium mb-3">Uploaded Photos:</p>
                  <div className="grid grid-cols-3 gap-3">
                    {uploadedImages.map((url, index) => (
                      <img
                        key={index}
                        src={url}
                        alt={`Uploaded ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border-2 border-gray-200"
                      />
                    ))}
                  </div>
                </div>
              )}
              <Button 
                onClick={() => router.push(`/book/${bookingId}`)}
                className="mt-6"
              >
                Return to Booking
              </Button>
            </div>
          ) : (
            <>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-lg font-medium mb-2">Select photos to upload</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose multiple photos from your appointment
                </p>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  variant="outline"
                  className="mb-2"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Choose Files
                </Button>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum file size: 10MB per photo
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-medium">Selected Photos ({files.length})</h3>
                  <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto">
                    {files.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index + 1}`}
                          className="w-full aspect-square object-cover rounded-lg border-2 border-gray-200"
                        />
                        <button
                          onClick={() => removeFile(index)}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="w-full"
                    size="lg"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Photos
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

