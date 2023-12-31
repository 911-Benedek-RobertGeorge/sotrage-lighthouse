import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { useGetLoginInfo } from "@multiversx/sdk-dapp/hooks";
import { API_URL, API_VERSION } from "../../utils/constants";
 import DataAssetCard from "../CardComponents/DataAssetCard";
import toast from "react-hot-toast";
import { Lightbulb, Loader2 } from "lucide-react";

interface DataStream {
  name: string;
  creator: string;
  created_on: string;
  last_modified_on: string;
  marshalManifest: {
    totalItems: number;
    nestedStream: boolean;
  };
}

interface ManifestFile {
  data_stream: DataStream;
  data: [];
  version: number;
  manifestFileName: string;
  folderCid: string;
  cidv1: string;
  hash: string;
  folderHash: string;
}

type DataAsset = {
  fileName: string;
  id: string;
  folderCid: string;
  cid: string;
  cidv1: string;
  mimeType: string;
  hash: string;
  folderHash: string;
};

export const DataAssetList: React.FC = () => {
  const [storedDataAssets, setStoredDataAssets] = useState<DataAsset[]>([]);
  const { tokenLogin } = useGetLoginInfo();
   const theToken = tokenLogin?.nativeAuthToken;
  const [manifestFiles, setManifestFiles] = useState<ManifestFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // fetch all data assets of an address
  async function fetchAllDataAssetsOfAnAddress() {
    const apiUrlGet = `${API_URL}/files${API_VERSION}?manifest=true`;
    setIsLoading(true);
    try {
      const response = await axios.get(apiUrlGet, {
        headers: {
          "authorization": `Bearer ${theToken}`,
        },
      });
      console.log("Data assets fetched", response.data);
      setStoredDataAssets(response.data);
    } catch (error: any) {
      console.error("Eror fetching data assets", error);
      if (error?.response.data.statusCode === 403) {
        toast("Native auth token expired. Re-login and try again! ", {
          icon: <Lightbulb color="yellow"></Lightbulb>,
        });
      } else {
        toast("Sorry, there’s a problem with the service, try again later " + `${error ? error.message + ". " + error?.response?.data.message : ""}`, {
          icon: <Lightbulb color="yellow"></Lightbulb>,
        });
      }
      throw error; // error to be catched by toast.promise
    }
  }

  // download the manifest file for the coresponding CID
  async function downloadTheManifestFile(folder: string, manifestFileName: string, manifest: string) {
    const apiUrlDownloadFile = `${API_URL}/file${API_VERSION}/` + manifest;

    try {
      const response = await axios.get(apiUrlDownloadFile, {
        headers: {
          "authorization": `Bearer ${theToken}`,
        },
      });
      if (!response.data?.data_stream) {
        /// empty manifest file or wrong format should not happen only with older versions
        console.log("Manifest file is empty or wrong format", manifest);
        return undefined;
      }
      const versionStampedManifestFile = { ...response.data, manifestFileName: manifestFileName, hash: manifest, folderHash: folder };
      setManifestFiles((prev) => [...prev, versionStampedManifestFile]);
    } catch (error) {
      console.log("Error downloading manifest files:", manifest, error);
      toast("Wait some more time for the manifest file to get pinned if you can't find the one you are looking for", {
        icon: <Lightbulb color="yellow"></Lightbulb>,
        id: "fetch-manifest-file1",
      });
    }
  }

  useEffect(() => {
    if (storedDataAssets.length === 0) {
      /// think about is, what happens if the user has no data assets
      toast.promise(fetchAllDataAssetsOfAnAddress(), {
        loading: "Fetching all data assets from Ipfs of your address...",
        success: <b>Fetched all data assets from Ipfs of your address!</b>,
        error: <b>The data assests could not be fetched. </b>,
      });
    }
  }, []);

  useEffect(() => {
    const downloadLatestVersionsManifestFiles = async () => {
      await Promise.all(
        storedDataAssets.map(async (manifestAsset) => {
          await downloadTheManifestFile(manifestAsset.folderHash, manifestAsset.fileName, manifestAsset.hash);
        })
      );
      setIsLoading(false);
    };

    if (storedDataAssets.length > 0) {
      downloadLatestVersionsManifestFiles();
    }
  }, [storedDataAssets]);
  return (
    <div className="p-4 flex flex-col">
      {isLoading && (
        <div className="flex justify-center items-center -mt-4">
          <Loader2 color="cyan" className="w-16 h-16 my-8 animate-spin "></Loader2>
        </div>
      )}
      <div className="gap-4 grid grid-cols-3">
        {!isLoading &&
          manifestFiles.map((manifest: ManifestFile, index) => (
            <Link
              key={index}
              to={"/upload"}
              state={{
                manifestFile: manifestFiles[index],
                action: "Update Data Asset",
                currentManifestFileCID: manifestFiles[index].hash,
                manifestFileName: manifestFiles[index].manifestFileName,
                folderCid: manifestFiles[index].folderHash,
              }}>
              <DataAssetCard dataAsset={manifest.data_stream}></DataAssetCard>
            </Link>
          ))}
      </div>
      {manifestFiles.length === 0 && !isLoading && (
        <div className="flex justify-center items-center">
          <p className="text-gray-400 text-2xl">No data assets found.</p>
        </div>
      )}
    </div>
  );
};
