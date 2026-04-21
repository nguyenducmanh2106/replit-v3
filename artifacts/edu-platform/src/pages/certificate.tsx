import { useParams, Link } from "@/lib/routing";
import { useGetCertificate } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Award, Printer, ArrowLeft } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function CertificatePage() {
  const { certNo } = useParams<{ certNo: string }>();
  const { data: cert, isLoading } = useGetCertificate(certNo);

  if (isLoading) return <Skeleton className="h-96 max-w-3xl mx-auto" />;
  if (!cert) return <p className="text-center py-12">Không tìm thấy chứng chỉ</p>;

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between print:hidden">
        <Link href="/certificates">
          <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Danh sách chứng chỉ</Button>
        </Link>
        <Button onClick={() => window.print()}><Printer className="w-4 h-4 mr-2" />In chứng chỉ</Button>
      </div>

      <div className="bg-white border-8 border-double border-yellow-600 p-12 text-center space-y-6 print:border-yellow-600 print:shadow-none">
        <div className="flex justify-center">
          <Award className="w-20 h-20 text-yellow-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold tracking-wide">CHỨNG CHỈ HOÀN THÀNH</h1>
          <p className="text-sm text-muted-foreground mt-2">Certificate of Completion</p>
        </div>

        <div className="py-6 space-y-3">
          <p className="text-lg text-muted-foreground">Chứng nhận rằng</p>
          <p className="text-3xl font-bold text-primary">{cert.userName}</p>
          <p className="text-lg text-muted-foreground">đã hoàn thành xuất sắc khóa học</p>
          <p className="text-2xl font-semibold">{cert.courseName}</p>
        </div>

        <div className="border-t pt-6 flex items-center justify-between text-sm">
          <div className="text-left">
            <p className="text-muted-foreground">Số chứng chỉ</p>
            <p className="font-mono font-semibold">{cert.certificateNo}</p>
          </div>
          <div className="text-right">
            <p className="text-muted-foreground">Ngày cấp</p>
            <p className="font-semibold">{format(parseISO(cert.issuedAt), "dd/MM/yyyy")}</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground italic pt-4">EduPlatform — Nền tảng Giáo dục</p>
      </div>
    </div>
  );
}
