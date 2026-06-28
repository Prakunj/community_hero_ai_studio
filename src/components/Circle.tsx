import React, {
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useRef
} from "react";
import { GoogleMapsContext, latLngEquals } from "@vis.gl/react-google-maps";

type CircleEventProps = {
  onClick?: (e: google.maps.MapMouseEvent) => void;
  onDrag?: (e: google.maps.MapMouseEvent) => void;
  onDragStart?: (e: google.maps.MapMouseEvent) => void;
  onDragEnd?: (e: google.maps.MapMouseEvent) => void;
  onMouseOver?: (e: google.maps.MapMouseEvent) => void;
  onMouseOut?: (e: google.maps.MapMouseEvent) => void;
};

export type CircleProps = google.maps.CircleOptions & CircleEventProps;

export type CircleRef = React.Ref<google.maps.Circle | null>;

function useCircle(props: CircleProps) {
  const {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut,
    radius,
    center,
    ...circleOptions
  } = props;

  const callbacks = useRef<Record<string, ((e: any) => void) | undefined>>({});
  Object.assign(callbacks.current, {
    onClick,
    onDrag,
    onDragStart,
    onDragEnd,
    onMouseOver,
    onMouseOut
  });

  const circle = useRef(new google.maps.Circle()).current;

  circle.setOptions(circleOptions);

  useEffect(() => {
    if (!center) return;
    if (!latLngEquals(center, circle.getCenter())) {
      circle.setCenter(center);
    }
  }, [center, circle]);

  useEffect(() => {
    if (radius === undefined || radius === null) return;
    if (radius !== circle.getRadius()) {
      circle.setRadius(radius);
    }
  }, [radius, circle]);

  const map = useContext(GoogleMapsContext)?.map;

  useEffect(() => {
    if (!map) {
      if (map === undefined) {
        console.error("<Circle> has to be inside a Map component.");
      }
      return;
    }

    circle.setMap(map);

    return () => {
      circle.setMap(null);
    };
  }, [map, circle]);

  useEffect(() => {
    if (!circle) return;

    const gme = google.maps.event;
    const listeners = [
      ["click", "onClick"],
      ["drag", "onDrag"],
      ["dragstart", "onDragStart"],
      ["dragend", "onDragEnd"],
      ["mouseover", "onMouseOver"],
      ["mouseout", "onMouseOut"]
    ].map(([eventName, eventCallback]) => {
      return gme.addListener(circle, eventName, (e: google.maps.MapMouseEvent) => {
        const callback = callbacks.current[eventCallback];
        if (callback) callback(e);
      });
    });

    return () => {
      listeners.forEach((l) => gme.removeListener(l));
    };
  }, [circle]);

  return circle;
}

export const Circle = forwardRef((props: CircleProps, ref: CircleRef) => {
  const circle = useCircle(props);
  useImperativeHandle(ref, () => circle);
  return null;
});

Circle.displayName = "Circle";
