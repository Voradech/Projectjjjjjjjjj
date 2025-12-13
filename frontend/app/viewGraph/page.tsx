"use client";
 import React from "react";
import { useEffect, useState } from "react";

const Page = () => {
  const [priceData, setPriceData] = useState<any[]>([]);

  useEffect(() => {
    fetch("http://localhost:3001/api/price")
      .then((res) => res.json())
      .then((data) => setPriceData(data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div>
      <h1>Predict View</h1>
      <pre>{JSON.stringify(priceData, null, 2)}</pre>
    </div>
  );
};

export default Page;
