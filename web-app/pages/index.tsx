import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Clock, FileText, GitBranch } from "lucide-react";

// Define the type for our data
type CommitData = {
  fileName: string;
  timeSpent: number;
  formattedTime: string;
};

export default function Home() {
  const [data, setData] = useState<CommitData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Function to receive messages from VS Code
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      console.log("Message received in Next.js app:", message);

      // Handle the data received from VS Code
      if (message.type === "commitData") {
        const formattedData = Object.entries(message.data).map(
          ([fileName, timeSpent]: [string, any]) => {
            // Convert milliseconds to minutes for display
            const minutes = Math.round(timeSpent / 60000);
            return {
              fileName: fileName.split("/").pop() || fileName, // Get just the filename
              timeSpent: minutes,
              formattedTime: `${minutes} min${minutes !== 1 ? "s" : ""}`,
            };
          }
        );

        // Sort by time spent (descending)
        formattedData.sort((a, b) => b.timeSpent - a.timeSpent);

        setData(formattedData);
        setIsLoading(false);
      }
    };

    // Add event listener for messages from VS Code
    if (typeof window !== "undefined") {
      window.addEventListener("message", handleMessage);

      // Let VS Code know we're ready to receive data
      if (typeof window.acquireVsCodeApi !== "undefined") {
        try {
          const vscode = window.acquireVsCodeApi();
          vscode.postMessage({ type: "ready" });
        } catch (e) {
          console.error("Error accessing VS Code API:", e);
        }
      } else {
        // For development outside VS Code, use sample data
        setTimeout(() => {
          const sampleData = {
            "/path/to/file1.ts": 120000,
            "/path/to/file2.ts": 300000,
            "/path/to/file3.ts": 180000,
          };

          const formattedData = Object.entries(sampleData).map(
            ([fileName, timeSpent]: [string, any]) => {
              const minutes = Math.round(timeSpent / 60000);
              return {
                fileName: fileName.split("/").pop() || fileName,
                timeSpent: minutes,
                formattedTime: `${minutes} min${minutes !== 1 ? "s" : ""}`,
              };
            }
          );

          formattedData.sort((a, b) => b.timeSpent - a.timeSpent);
          setData(formattedData);
          setIsLoading(false);
        }, 1000);
      }
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("message", handleMessage);
      }
    };
  }, []);

  // Calculate total time spent
  const totalMinutes = data.reduce(
    (total: number, item: CommitData) => total + item.timeSpent,
    0
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const totalTimeFormatted =
    hours > 0
      ? `${hours} hr${hours !== 1 ? "s" : ""} ${minutes} min${
          minutes !== 1 ? "s" : ""
        }`
      : `${minutes} min${minutes !== 1 ? "s" : ""}`;

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto">
        <h1 className="text-3xl font-bold mb-8">Commit Curve</h1>

        {isLoading ? (
          <div className="flex justify-center items-center h-64">
            <p className="text-muted-foreground">Loading data...</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Time
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 text-muted-foreground mr-2" />
                    <span className="text-2xl font-bold">
                      {totalTimeFormatted}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Files Tracked
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 text-muted-foreground mr-2" />
                    <span className="text-2xl font-bold">{data.length}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Most Active File
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center">
                    <GitBranch className="h-4 w-4 text-muted-foreground mr-2" />
                    <span className="text-2xl font-bold">
                      {data.length > 0 ? data[0].fileName : "None"}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Time Spent Per File</CardTitle>
                <CardDescription>
                  Visualization of time spent on each file
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={data.slice(0, 10)} // Show top 10 files
                      margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="fileName"
                        angle={-45}
                        textAnchor="end"
                        height={70}
                      />
                      <YAxis
                        label={{
                          value: "Minutes",
                          angle: -90,
                          position: "insideLeft",
                        }}
                      />
                      <Tooltip
                        formatter={(value) => [
                          `${value} minutes`,
                          "Time Spent",
                        ]}
                        labelFormatter={(label) => `File: ${label}`}
                      />
                      <Bar dataKey="timeSpent" fill="#3b82f6" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detailed Breakdown</CardTitle>
                <CardDescription>
                  Time spent on each file in your project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4">File</th>
                        <th className="text-right py-3 px-4">Time Spent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((item, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3 px-4">{item.fileName}</td>
                          <td className="text-right py-3 px-4">
                            {item.formattedTime}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
