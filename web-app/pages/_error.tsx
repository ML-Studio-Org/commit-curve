import { NextPage } from "next";
import Error, { ErrorProps } from "next/error";
import { NextPageContext } from "next";

interface CustomErrorProps {
  statusCode: number;
  hasGetInitialPropsRun?: boolean;
  err?: Error;
}

const ErrorPage: NextPage<CustomErrorProps> = ({ statusCode }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">
        {statusCode
          ? `An error ${statusCode} occurred on server`
          : "An error occurred on client"}
      </h1>
      <p className="text-gray-600">
        Please try refreshing the page or contact support if the problem
        persists.
      </p>
    </div>
  );
};

ErrorPage.getInitialProps = async ({
  res,
  err,
}: NextPageContext): Promise<CustomErrorProps> => {
  const statusCode = res
    ? res.statusCode
    : err
    ? (err as any).statusCode || 500
    : 404;
  return { statusCode };
};

export default ErrorPage;
